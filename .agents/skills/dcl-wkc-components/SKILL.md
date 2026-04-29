---
name: dcl-wkc-components
description: Decentraland Well-Known Components (WKC) backend architecture. ALWAYS follow when writing, modifying, or reviewing component files in src/components.ts, src/adapters/, src/logic/, src/controllers/, src/types/, or any file importing from @well-known-components. Covers component interfaces, factory pattern, lifecycle, dependency injection, error handling, and documentation.
license: MIT
---

# Well-Known Components (WKC) Standards

## Scope

Apply to: component files (`src/components.ts`, `test/components.ts`), type definitions (`src/types/*.ts`), adapters (`src/adapters/**/*.ts`), logic components (`src/logic/*/component.ts`), controllers (`src/controllers/handlers/**/*.ts`), and API docs (`docs/openapi.yaml`).

## Core Rules

### 1. Component Interface Design (MUST)

All components must extend `IBaseComponent` from `@well-known-components/interfaces`. Interfaces go in `types/components.ts`.

```typescript
// BAD
export interface IUserComponent {
  getUser: (id: string) => User
}

// GOOD
export interface IUserComponent extends IBaseComponent {
  getUser: (id: string) => Promise<User>
}
```

### 2. Factory Pattern (MUST)

Use async factory functions with `create*Component` naming. Accept dependencies via `Pick<AppComponents, ...>`.

```typescript
// BAD
export function createUserComponent(db: any, logger: any) { ... }

// GOOD
export async function createUserComponent(
  components: Pick<AppComponents, 'database' | 'logger'>
): Promise<IUserComponent> {
  const { database, logger } = components
  return {
    async getUser(id: string): Promise<User> {
      logger.info('Fetching user', { userId: id })
      return await database.query('SELECT * FROM users WHERE id = $1', [id])
    }
  }
}
```

### 3. Lifecycle Management (MUST)

Implement `START_COMPONENT` and `STOP_COMPONENT` symbols for stateful components:

```typescript
export async function createJobComponent(
  components: Pick<AppComponents, 'config'>
): Promise<IJobComponent> {
  const { config } = components
  let intervalId: NodeJS.Timer | undefined

  const start = async () => {
    intervalId = setInterval(() => { /* job logic */ }, config.getNumber('JOB_INTERVAL', 5000))
  }

  const stop = async () => {
    if (intervalId) { clearInterval(intervalId); intervalId = undefined }
  }

  return {
    [START_COMPONENT]: start,
    [STOP_COMPONENT]: stop,
    scheduleJob: (job) => { /* implementation */ }
  }
}
```

### 4. Directory Organization (MUST)

| Directory | Purpose |
|---|---|
| `src/adapters/` | External service integrations (DB, APIs, S3, SNS) |
| `src/logic/` | Business logic components (domain-specific) |
| `src/controllers/` | Request/response handling (HTTP, RPC, WebSocket) |
| `src/types/` | Shared type definitions |

Component file patterns:
- Interface in `types/components.ts` or `logic/component/types.ts`
- Implementation in `logic/component/component.ts` with `index.ts` for exports
- Wiring in `components.ts`

### 5. Dependency Injection (MUST)

Use `Pick<AppComponents, 'dep1' | 'dep2'>` for explicit dependencies. Destructure at the start of factory functions. Avoid circular dependencies.

### 6. Error Handling (SHOULD)

Use typed error classes, implement proper logging/tracing, handle init failures gracefully.

### 7. JSDoc Documentation (MUST)

- Document all factory functions with description, orchestration flow, and `@param`/`@returns`
- Document all public methods with `@param`, `@returns`, `@throws`
- Document interface methods for IDE support
- Document complex flows with numbered steps

### 8. OpenAPI Documentation (MUST)

- Create `docs/openapi.yaml` with OpenAPI 3.x.x
- Document all HTTP endpoints with request/response schemas
- Include error responses with proper status codes
- Update whenever endpoints change

For complete examples and detailed patterns, see [references/REFERENCE.md](references/REFERENCE.md)
