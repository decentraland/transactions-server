# TODO: Pluggable relay strategies with fallback

## Status

**Deferred.** We're consolidating to a single relayer (OpenZeppelin) after Gelato's end-of-May 2026 sunset, and at current transaction volume the abstraction isn't worth the maintenance cost. Capturing the design here so it's ready to lift if a second provider is reintroduced or OZ-only reliability proves insufficient.

## Why we considered this

After PR #133 (OZ readiness-probe removal) the pod stays up when OZ has issues, but a transient failure on the chosen provider still returns HTTP 500 to the client even when the other provider is healthy and would have handled the request. During the Gelato → OZ transition we wanted automatic retry on the other provider for transient errors.

## Inspiration

The shape below is lifted from `cloudflare-workers/workers/subgraph-provider/strategy/` (`Strategy.ts`, `RandomAndFallback.ts`, `PrioritizeAndRandomFallback.ts`). We keep the *interface + concrete-class-per-behavior* shape but strip the extras for simplicity:

- No cooldowns
- No per-subgraph overrides
- No weighted random
- No response-body inspection

## Interface

```typescript
// src/ports/relay-router/strategy/Strategy.ts
import { TransactionData } from '../../../types/transactions/transactions'

export interface Strategy {
  send(
    tx: TransactionData,
    onProviderError: (err: Error) => void
  ): Promise<string>
}
```

```typescript
// src/ports/relay-router/strategy/Strategy.errors.ts
export class ProvidersFailed extends Error {
  constructor() {
    super('All relay providers failed')
  }
}
```

```typescript
// src/ports/relay-router/strategy/types.ts
import { IMetaTransactionProviderComponent } from '../../../types/transactions/transactions'

export type NamedProvider = {
  name: string
  component: IMetaTransactionProviderComponent
}
```

## Concrete strategies

Both walk a list of providers, advancing on transient errors and short-circuiting on permanent ones.

### `RandomAndFallback`

Pick one provider at random, fall back through the rest.

```typescript
// src/ports/relay-router/strategy/impl/RandomAndFallback.ts
import { InvalidTransactionError } from '../../../../types/transactions'
import { Strategy } from '../Strategy'
import { ProvidersFailed } from '../Strategy.errors'
import { NamedProvider } from '../types'
import { pickRandomAndUnshift } from '../utils'

export class RandomAndFallback implements Strategy {
  constructor(private providers: NamedProvider[]) {}

  async send(
    tx,
    onProviderError: (err: Error) => void
  ): Promise<string> {
    for (const provider of pickRandomAndUnshift(this.providers)) {
      try {
        return await provider.component.sendMetaTransaction(tx)
      } catch (err) {
        if (err instanceof InvalidTransactionError) throw err
        onProviderError(err as Error)
      }
    }
    throw new ProvidersFailed()
  }
}
```

### `PriorityAndFallback`

Walk providers in their declared order; on transient failure, advance to the next.

```typescript
// src/ports/relay-router/strategy/impl/PriorityAndFallback.ts
import { InvalidTransactionError } from '../../../../types/transactions'
import { Strategy } from '../Strategy'
import { ProvidersFailed } from '../Strategy.errors'
import { NamedProvider } from '../types'

export class PriorityAndFallback implements Strategy {
  constructor(private providers: NamedProvider[]) {} // top priority first

  async send(
    tx,
    onProviderError: (err: Error) => void
  ): Promise<string> {
    for (const provider of this.providers) {
      try {
        return await provider.component.sendMetaTransaction(tx)
      } catch (err) {
        if (err instanceof InvalidTransactionError) throw err
        onProviderError(err as Error)
      }
    }
    throw new ProvidersFailed()
  }
}
```

### Helper

```typescript
// src/ports/relay-router/strategy/utils.ts
import { NamedProvider } from './types'

export function pickRandomAndUnshift(providers: NamedProvider[]): NamedProvider[] {
  const i = Math.floor(Math.random() * providers.length)
  const copy = [...providers]
  const picked = copy.splice(i, 1)[0]
  copy.unshift(picked)
  return copy
}
```

## Wiring

The relay-router picks a `Strategy` from the existing `relay-provider` feature flag value:

| Flag value | Strategy |
|---|---|
| `"random-and-fallback"` | `new RandomAndFallback([oz, gelato])` |
| `"priority-and-fallback"` | `new PriorityAndFallback([oz, gelato])` (OZ first, Gelato as safety net) |
| `"gelato"` / `"openzeppelin"` / `"random"` / missing / unknown | today's 1-shot behavior, unchanged |

Then the router's `sendMetaTransaction` becomes:

```typescript
return strategy.send(tx, (err) => {
  logger.warn(`Provider failed transiently`, { error: err.message })
  metrics.increment('dcl_relay_fallback_attempts')
})
```

## Error policy

| Error | Cause | Next provider? |
|---|---|---|
| `RelayerError` | network / 5xx / no-balance / malformed response | yes |
| `RelayerTimeout` | poll/wait exhaustion | yes |
| `InvalidTransactionError` | reverted / cancelled / 422 / 400 / terminal failed | no — rethrow |

Both Gelato and OZ throw the same error taxonomy (`src/types/transactions/errors.ts`), so the rule is symmetric.

When all legs fail, throw `ProvidersFailed`. Map it to HTTP 500 in `src/controllers/handlers.ts` (one new `instanceof` branch alongside the existing `RelayerTimeout` / `InvalidTransactionError` ones).

## Metrics to add (`src/metrics.ts`)

- `dcl_relay_fallback_attempts` — incremented per failed leg.
- `dcl_relay_fallback_success` — incremented when a non-primary provider rescues the request.

## Tests

Strategy classes are pure logic, so they unit-test cleanly. Per `dcl-testing` (describe-when/and, per-context `beforeEach`, no recreated SUT):

- `test/tests/ports/relay-router/strategy/random-and-fallback.spec.ts`
- `test/tests/ports/relay-router/strategy/priority-and-fallback.spec.ts`
- Existing `relay-router-component.spec.ts` gains contexts for the FF → Strategy wiring.

## Revisit when

- A second provider is reintroduced to the routing table.
- OZ-only proves insufficiently reliable in production.
- Per-request HTTP 500s on transient OZ outages become a measurable problem.
