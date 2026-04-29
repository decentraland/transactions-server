---
name: dcl-backend-standards
description: Decentraland backend coding standards. ALWAYS follow when writing, modifying, or reviewing any *.ts file in a backend service. Covers type safety, error handling, security, HTTP conventions, logging, environment config, database access, async discipline, and outbound call patterns.
license: MIT
---

# Backend Coding Standards

## Scope

Apply to: all `*.ts` files in Decentraland backend services (test files excluded — see dcl-testing).

## Core Rules

### 1. Type Safety (MUST)

Avoid `as` type assertions. Use `Pick<>`, `Partial<>`, type guards, or proper type narrowing instead.

```typescript
// BAD
const user = { id, name } as UserAttributes

// GOOD
const user: Pick<UserAttributes, 'id' | 'name'> = { id, name }
```

Never use non-null assertions (`!`) without a preceding guard that throws a domain error.

```typescript
// BAD
const roomId = session.room_id!

// GOOD
if (!session.room_id) {
  throw new MissingRoomError('Session has no room_id')
}
const roomId = session.room_id
```

Prefer explicit return types on exported functions.

### 2. Error Handling (MUST)

Always guard `JSON.parse` on external or stored data with try/catch.

```typescript
// BAD
const metadata = JSON.parse(record?.metadata || '{}')

// GOOD
let metadata: RecordMetadata = {}
try {
  metadata = JSON.parse(record?.metadata || '{}')
} catch {
  logger.warn('Failed to parse record metadata', { recordId })
}
```

When adding a guard or pattern to one code path, apply it consistently to all similar paths. If `removeItem` has a null guard, `addItem` must too.

Use typed domain error classes, not generic `Error`.

Wrap HTTP handler bodies in a single try-catch. Business logic and validation throw typed domain errors; the catch block maps each error type to the correct HTTP status and response body in one place. Avoid multiple early returns that each manually construct status + error body.

```typescript
// BAD — duplicated response shaping, multiple return points
async function handleUpdateItem(ctx: Context) {
  const item = await db.getItem(ctx.params.id)
  if (!item) {
    return { status: 404, body: { ok: false, message: 'Item not found' } }
  }

  if (item.owner !== ctx.auth.address) {
    return { status: 403, body: { ok: false, message: 'Not the owner' } }
  }

  const updated = await db.updateItem(ctx.params.id, ctx.body)
  return { status: 200, body: { ok: true, data: updated } }
}

// GOOD — single try-catch, typed errors, one response-shaping point
async function handleUpdateItem(ctx: Context) {
  try {
    const item = await getItemOrThrow(ctx.params.id)       // throws NotFoundError
    assertOwnership(item, ctx.auth.address)                 // throws ForbiddenError
    const updated = await db.updateItem(ctx.params.id, ctx.body)
    return { status: 200, body: { ok: true, data: updated } }
  } catch (error) {
    return mapErrorToResponse(error)
  }
}
```

### 3. Security (MUST)

Validate the full request schema at the service boundary. Do not rely on individual field checks scattered through business logic.

```typescript
// BAD — validation scattered, easy to miss fields
async function handleCreateItem(ctx: Context) {
  if (!ctx.body.name) throw new ValidationError('name required')
  // description is never validated...
}

// GOOD — validate entire schema at the edge, using whatever validation library the project uses
const CreateItemSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 200 },
    tags: { type: 'array', items: { type: 'string', maxLength: 50 }, maxItems: 20 },
  },
  required: ['name'],
  additionalProperties: false,
}
```

Always set `maxLength` on string fields and `maxItems` on array fields in request schemas to prevent payload abuse.

Be explicit about type coercion at boundaries. Query parameters and environment variables are always strings — parse and validate them intentionally.

```typescript
// BAD — parseInt silently succeeds on partial input
const limit = parseInt(ctx.query.limit) // parseInt("123abc") → 123

// GOOD — strict numeric parsing with validation
const limit = Number(ctx.query.limit)
if (!Number.isFinite(limit) || limit < 1 || limit > 100) {
  throw new ValidationError('limit must be a number between 1 and 100')
}
```

Prefer allowlists over denylists when validating input values.

All HTTP endpoints must have auth middleware (`auth`, `tokenAuthMiddleware`, or equivalent) unless the reason for omitting it is explicitly documented in a code comment.

Follow the principle of least privilege for permissions. Default to the most restrictive option.

```typescript
// BAD — grants unnecessary permissions
canUpdateMetadata: true  // default, but viewers don't need this

// GOOD — explicitly restrictive
canUpdateMetadata: false
```

### 4. HTTP Conventions (MUST)

Use correct HTTP status codes:

| Code | Meaning         | When to use                                      |
|------|-----------------|--------------------------------------------------|
| 401  | Unauthenticated | Identity unknown — who are you?                  |
| 403  | Unauthorized    | Identity known but access denied — you can't do this |
| 404  | Not Found       | Resource does not exist                          |
| 409  | Conflict        | Action conflicts with current state              |

```typescript
// BAD — user is authenticated but not an admin
throw new HttpError(401, 'Not authorized')

// GOOD
throw new HttpError(403, 'Admin access required')
```

### 5. Logging & Observability (SHOULD)

Use structured logging via the `logger` component. Never use `console.log`.

```typescript
// BAD
console.log('Failed to process request')

// GOOD
logger.warn('Failed to process request', { requestId, userId, reason })
```

Always include context objects in log calls with relevant IDs and operation details.

Use appropriate log levels: `error` for failures requiring attention, `warn` for recoverable issues, `info` for significant operations, `debug` for troubleshooting detail.

### 6. Environment & Config (SHOULD)

Read environment variables through the `config` component. Never access `process.env` directly.

```typescript
// BAD
const port = process.env.PORT || '3000'

// GOOD
const port = await config.getString('PORT', '3000')
```

Always provide sensible default values for optional configuration.

Do not hardcode values that should be configurable (URLs, ports, intervals, thresholds).

### 7. Database Access (MUST)

Always use parameterized queries. Never interpolate variables into SQL strings.

```typescript
// BAD — SQL injection risk
const result = await db.query(`SELECT * FROM items WHERE id = '${id}'`)

// GOOD — parameterized
const result = await db.query('SELECT * FROM items WHERE id = $1', [id])
```

Wrap multi-step mutations in a transaction. If any step fails, the entire operation rolls back.

```typescript
// BAD — partial failure leaves inconsistent state
await db.query('INSERT INTO orders ...', [orderData])
await db.query('UPDATE inventory SET quantity = quantity - $1 ...', [qty])

// GOOD — atomic operation
await db.withTransaction(async (client) => {
  await client.query('INSERT INTO orders ...', [orderData])
  await client.query('UPDATE inventory SET quantity = quantity - $1 ...', [qty])
})
```

Use the WKC database component for connection pooling — never create per-request connections.

Prevent N+1 queries: batch-load related data with `WHERE id = ANY($1)` or joins instead of looping queries.

Set `statement_timeout` on long-running queries to prevent runaway operations from exhausting connections.

### 8. Async Discipline (MUST)

Never call an async function without `await` unless it is intentionally fire-and-forget — in that case, attach `.catch()` and add a comment explaining why.

```typescript
// BAD — floating promise, errors vanish silently
sendNotification(userId, message)

// GOOD — awaited
await sendNotification(userId, message)

// GOOD — intentional fire-and-forget with error handling
// Fire-and-forget: notification failure must not block the response
sendNotification(userId, message).catch((err) =>
  logger.warn('Failed to send notification', { userId, error: err.message })
)
```

Never use `forEach` with async callbacks — iterations run concurrently with no await and no error propagation.

```typescript
// BAD — silently swallowed errors, no backpressure
items.forEach(async (item) => {
  await processItem(item)
})

// GOOD — concurrent with error propagation
await Promise.all(items.map((item) => processItem(item)))

// GOOD — sequential when order or rate matters
for (const item of items) {
  await processItem(item)
}
```

Use `Promise.all` when all results are required (fail-fast on first rejection). Use `Promise.allSettled` when partial success is acceptable and you need to inspect each outcome.

Always clean up resources in `finally` blocks in async flows (open handles, temp files, locks).

### 9. Outbound Calls (SHOULD)

Set an explicit timeout on every outbound HTTP call. Never rely on default TCP timeouts.

```typescript
// BAD — no timeout, can hang for minutes
const response = await fetch('https://external-api.example.com/data')

// GOOD — explicit timeout
const response = await fetch('https://external-api.example.com/data', {
  signal: AbortSignal.timeout(5000),
})
```

Distinguish retryable errors from fatal ones. Retry `503`, `429`, and network errors with exponential backoff and jitter. Do not retry `400`, `401`, `403`, or `404`.

```typescript
// BAD — retries everything blindly
for (let i = 0; i < 3; i++) {
  try { return await callExternalService(); } catch { /* retry */ }
}

// GOOD — only retry transient failures
const isRetryable = (status: number) => [503, 429, 502].includes(status)
```

## Related Skills (optional companions)

These skills complement `dcl-backend-standards` but are not required:

- Architecture & component design (WKC structure, lifecycle, DI): `dcl-wkc-components`
- Test patterns and mocking: `dcl-testing`

---

For extended examples, common mistakes, and AI validation checklist, see [references/REFERENCE.md](references/REFERENCE.md)
