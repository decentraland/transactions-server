# Backend Coding Standards - Detailed Reference

## Examples

### Type Safety

```typescript
// BAD — type assertion hides a missing required field
const response = { status: 'ok' } as ApiResponse

// GOOD — compiler enforces the correct shape
const response: Pick<ApiResponse, 'status'> = { status: 'ok' }
```

```typescript
// BAD — non-null assertion without guard
const userId = request.auth.userId!
await database.query('DELETE FROM sessions WHERE user_id = $1', [userId])

// GOOD — guard throws a domain error, then access is safe
if (!request.auth.userId) {
  throw new UnauthenticatedError('Missing user ID in auth context')
}
const userId = request.auth.userId
await database.query('DELETE FROM sessions WHERE user_id = $1', [userId])
```

```typescript
// BAD — as bypasses narrowing on union types
function getDisplayName(entity: User | Organization) {
  return (entity as User).firstName
}

// GOOD — type guard with proper narrowing
function isUser(entity: User | Organization): entity is User {
  return 'firstName' in entity
}

function getDisplayName(entity: User | Organization): string {
  if (isUser(entity)) {
    return entity.firstName
  }
  return entity.orgName
}
```

### Error Handling

```typescript
// BAD — JSON.parse on data from external source without guard
async function getSettings(key: string): Promise<Settings> {
  const raw = await redis.get(key)
  return JSON.parse(raw || '{}')
}

// GOOD — guarded with try/catch, logged, safe default
async function getSettings(key: string): Promise<Settings> {
  const raw = await redis.get(key)
  let settings: Settings = {}
  try {
    settings = JSON.parse(raw || '{}')
  } catch {
    logger.warn('Failed to parse settings from cache', { key })
  }
  return settings
}
```

```typescript
// BAD — guard on removeItem but not addItem
function removeItem(list: string[] | null, item: string): string[] {
  if (!list) return []
  return list.filter(i => i !== item)
}

function addItem(list: string[], item: string): string[] {
  return [...list, item] // crashes if list is null
}

// GOOD — consistent null guard on both paths
function removeItem(list: string[] | null, item: string): string[] {
  if (!list) return []
  return list.filter(i => i !== item)
}

function addItem(list: string[] | null, item: string): string[] {
  if (!list) return [item]
  return [...list, item]
}
```

### Handler Error Flow

```typescript
// BAD — each error condition builds its own response, logic is scattered
async function handleCreateProject(ctx: Context) {
  const { name, description } = ctx.body

  if (!name || name.length > 128) {
    return { status: 400, body: { ok: false, message: 'Invalid project name' } }
  }

  const org = await db.getOrganization(ctx.body.orgId)
  if (!org) {
    return { status: 404, body: { ok: false, message: 'Organization not found' } }
  }

  if (!org.members.includes(ctx.auth.address)) {
    return { status: 403, body: { ok: false, message: 'Not a member of this organization' } }
  }

  const existing = await db.getProjectByName(org.id, name)
  if (existing) {
    return { status: 409, body: { ok: false, message: 'Project name already taken' } }
  }

  const project = await db.createProject({ name, description, orgId: org.id })
  return { status: 201, body: { ok: true, data: project } }
}

// GOOD — validation and business logic throw typed errors, single catch maps them
async function handleCreateProject(ctx: Context) {
  try {
    const { name, description } = validateProjectInput(ctx.body)  // throws ValidationError
    const org = await getOrganizationOrThrow(ctx.body.orgId)      // throws NotFoundError
    assertMembership(org, ctx.auth.address)                        // throws ForbiddenError
    await assertProjectNameAvailable(org.id, name)                 // throws ConflictError

    const project = await db.createProject({ name, description, orgId: org.id })
    return { status: 201, body: { ok: true, data: project } }
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

// Shared error-to-response mapper (used by all handlers)
function mapErrorToResponse(error: unknown) {
  if (error instanceof ValidationError) {
    return { status: 400, body: { ok: false, message: error.message } }
  }
  if (error instanceof NotFoundError) {
    return { status: 404, body: { ok: false, message: error.message } }
  }
  if (error instanceof ForbiddenError) {
    return { status: 403, body: { ok: false, message: error.message } }
  }
  if (error instanceof ConflictError) {
    return { status: 409, body: { ok: false, message: error.message } }
  }
  logger.error('Unhandled error in request handler', { error: String(error) })
  return { status: 500, body: { ok: false, message: 'Internal server error' } }
}
```

### Security

```typescript
// BAD — no length constraints on string fields
const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    identity: { type: 'string' }
  }
}

// GOOD — all string fields have maxLength
const schema = {
  type: 'object',
  properties: {
    name: { type: 'string', maxLength: 128 },
    description: { type: 'string', maxLength: 1024 },
    identity: { type: 'string', maxLength: 256 }
  }
}
```

```typescript
// BAD — no array bounds, attacker can send 1M tags
const schema = {
  type: 'object',
  properties: {
    tags: { type: 'array', items: { type: 'string' } }
  }
}

// GOOD — bounded arrays with bounded items
const schema = {
  type: 'object',
  properties: {
    tags: { type: 'array', items: { type: 'string', maxLength: 50 }, maxItems: 20 }
  }
}
```

```typescript
// BAD — trusting query param as number without validation
const page = parseInt(ctx.query.page)       // parseInt("12abc") → 12
const limit = Number(ctx.query.limit)       // Number("") → 0

// GOOD — explicit parsing and range validation
const page = Number(ctx.query.page)
if (!Number.isInteger(page) || page < 1) {
  throw new ValidationError('page must be a positive integer')
}
const limit = Number(ctx.query.limit)
if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
  throw new ValidationError('limit must be between 1 and 100')
}
```

```typescript
// BAD — endpoint with no auth and no explanation
router.post('/items', handleCreateItem)

// GOOD — auth middleware present
router.post('/items', auth, handleCreateItem)

// GOOD — public endpoint with documented reason
// Public: items listing is available without authentication for catalog display
router.get('/items', handleListItems)
```

### HTTP Conventions

```typescript
// BAD — returns 401 when the user is authenticated but lacks admin role
async function handleDeleteUser(ctx: Context): Promise<void> {
  const caller = ctx.auth.address
  if (!isAdmin(caller)) {
    throw new HttpError(401, 'Not authorized') // wrong: user IS authenticated
  }
  await deleteUser(ctx.params.id)
}

// GOOD — 403 for known identity without permission
async function handleDeleteUser(ctx: Context): Promise<void> {
  const caller = ctx.auth.address
  if (!isAdmin(caller)) {
    throw new HttpError(403, 'Admin access required')
  }
  await deleteUser(ctx.params.id)
}
```

### Logging & Observability

```typescript
// BAD — unstructured logging with no context
console.log('Error processing webhook')
console.log('User created successfully')

// GOOD — structured logging with context and appropriate levels
logger.error('Failed to process webhook', { webhookId, error: err.message })
logger.info('User created', { userId, email })
```

```typescript
// BAD — logging sensitive data
logger.info('User login', { email, password, token })

// GOOD — only log identifiers and non-sensitive context
logger.info('User login', { userId, email })
```

### Environment & Config

```typescript
// BAD — direct process.env access scattered across files
const dbHost = process.env.DB_HOST || 'localhost'
const dbPort = parseInt(process.env.DB_PORT || '5432')
const apiUrl = 'https://api.example.com/v1' // hardcoded

// GOOD — config component with defaults
const dbHost = await config.getString('DB_HOST', 'localhost')
const dbPort = await config.getNumber('DB_PORT', 5432)
const apiUrl = await config.requireString('API_URL') // no default — must be set
```

### Database Access

```typescript
// BAD — string interpolation in SQL
async function getItem(id: string) {
  return db.query(`SELECT * FROM items WHERE id = '${id}'`)
}

// GOOD — parameterized query
async function getItem(id: string) {
  return db.query('SELECT * FROM items WHERE id = $1', [id])
}
```

```typescript
// BAD — N+1: one query per order to fetch items
async function getOrdersWithItems(orderIds: string[]) {
  const orders = await db.query('SELECT * FROM orders WHERE id = ANY($1)', [orderIds])
  for (const order of orders.rows) {
    order.items = await db.query('SELECT * FROM items WHERE order_id = $1', [order.id])
  }
  return orders.rows
}

// GOOD — batch load with a single query
async function getOrdersWithItems(orderIds: string[]) {
  const orders = await db.query('SELECT * FROM orders WHERE id = ANY($1)', [orderIds])
  const items = await db.query('SELECT * FROM items WHERE order_id = ANY($1)', [orderIds])
  const itemsByOrder = new Map<string, Item[]>()
  for (const item of items.rows) {
    const list = itemsByOrder.get(item.order_id) || []
    list.push(item)
    itemsByOrder.set(item.order_id, list)
  }
  return orders.rows.map((order) => ({ ...order, items: itemsByOrder.get(order.id) || [] }))
}
```

```typescript
// BAD — no transaction, partial failure leaves orphan record
async function createProjectWithOwner(projectData: ProjectInput, userId: string) {
  const project = await db.query('INSERT INTO projects ... RETURNING id', [projectData])
  await db.query('INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
    [project.rows[0].id, userId, 'owner'])
}

// GOOD — transactional, atomic operation
async function createProjectWithOwner(projectData: ProjectInput, userId: string) {
  await db.withTransaction(async (client) => {
    const project = await client.query('INSERT INTO projects ... RETURNING id', [projectData])
    await client.query('INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
      [project.rows[0].id, userId, 'owner'])
  })
}
```

### Async Discipline

```typescript
// BAD — floating promise: if analytics throws, error is swallowed
function handleUserAction(userId: string, action: string) {
  trackAnalytics(userId, action) // async but not awaited, no catch
  return { ok: true }
}

// GOOD — awaited
async function handleUserAction(userId: string, action: string) {
  await trackAnalytics(userId, action)
  return { ok: true }
}

// GOOD — intentional fire-and-forget with error handling and comment
function handleUserAction(userId: string, action: string) {
  // Fire-and-forget: analytics failure must not block the user response
  trackAnalytics(userId, action).catch((err) =>
    logger.warn('Analytics tracking failed', { userId, action, error: err.message })
  )
  return { ok: true }
}
```

```typescript
// BAD — forEach with async: iterations run uncontrolled, errors vanish
async function notifyUsers(userIds: string[], message: string) {
  userIds.forEach(async (userId) => {
    await sendNotification(userId, message)
  })
  // function returns before any notification is sent
}

// GOOD — concurrent with error propagation
async function notifyUsers(userIds: string[], message: string) {
  await Promise.all(userIds.map((userId) => sendNotification(userId, message)))
}

// GOOD — sequential when order or rate limiting matters
async function notifyUsers(userIds: string[], message: string) {
  for (const userId of userIds) {
    await sendNotification(userId, message)
  }
}
```

```typescript
// BAD — Promise.all when partial success is acceptable (one failure kills all)
async function syncAllProviders(providers: Provider[]) {
  const results = await Promise.all(providers.map((p) => p.sync()))
  return results
}

// GOOD — Promise.allSettled to handle partial success
async function syncAllProviders(providers: Provider[]) {
  const results = await Promise.allSettled(providers.map((p) => p.sync()))
  const failures = results.filter((r) => r.status === 'rejected')
  if (failures.length > 0) {
    logger.warn('Some providers failed to sync', { failedCount: failures.length })
  }
  return results
    .filter((r): r is PromiseFulfilledResult<SyncResult> => r.status === 'fulfilled')
    .map((r) => r.value)
}
```

### Outbound Calls

```typescript
// BAD — no timeout, request can hang indefinitely
async function fetchExternalProfile(userId: string) {
  const response = await fetch(`https://api.external.com/users/${userId}`)
  return response.json()
}

// GOOD — explicit timeout
async function fetchExternalProfile(userId: string) {
  const response = await fetch(`https://api.external.com/users/${userId}`, {
    signal: AbortSignal.timeout(5000),
  })
  return response.json()
}
```

```typescript
// BAD — retries all errors including client errors
async function callWithRetry(fn: () => Promise<Response>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fn()
    } catch {
      if (attempt === 2) throw new Error('Max retries exceeded')
    }
  }
}

// GOOD — only retry transient failures, with backoff and jitter
const RETRYABLE_STATUS = new Set([502, 503, 429])

async function callWithRetry(fn: () => Promise<Response>, maxAttempts = 3) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fn()
    if (response.ok || !RETRYABLE_STATUS.has(response.status)) {
      return response
    }
    if (attempt < maxAttempts - 1) {
      const backoff = Math.min(1000 * 2 ** attempt, 10000)
      const jitter = Math.random() * backoff * 0.1
      await new Promise((resolve) => setTimeout(resolve, backoff + jitter))
    }
  }
  throw new Error('Max retries exceeded for transient failure')
}
```

## Common Mistakes

| Mistake | Fix |
|---|---|
| `as SomeType` to silence the compiler | Use `Pick<>`, `Partial<>`, or a type guard |
| `obj.prop!` without preceding check | Add a null/undefined guard that throws a domain error |
| Unguarded `JSON.parse` on external data | Wrap in try/catch, log the failure, use a safe default |
| String fields without `maxLength` in schema validation | Add length constraints to all string fields |
| HTTP endpoint missing auth middleware | Add auth middleware or document why it's intentionally public |
| 401 for "not authorized" | Use 403 — 401 means identity is unknown (unauthenticated) |
| `console.log` in production code | Use the structured `logger` component with context |
| `process.env.VAR` accessed directly | Use `config.getString('VAR', defaultValue)` |
| Guard on one path but not its sibling | Apply the same guard pattern to all similar code paths |
| Multiple early returns in handler, each building status + error body | Wrap handler in try-catch; throw typed domain errors; map them in a single catch block |
| Hardcoded URLs, ports, or timeouts | Move to config with sensible defaults |
| Logging sensitive data (passwords, tokens) | Only log identifiers and non-sensitive context |
| String interpolation in SQL (`WHERE id = '${id}'`) | Use parameterized queries (`WHERE id = $1`, `[id]`) |
| Query inside a loop (N+1) | Batch-load with `WHERE id = ANY($1)` or use joins |
| Multi-step DB mutation without transaction | Wrap in `db.withTransaction()` |
| Async function called without `await` or `.catch()` | Await it, or add `.catch()` with a comment if fire-and-forget |
| `forEach` with async callback | Use `Promise.all(arr.map(...))` or `for...of` |
| `Promise.all` when partial success is acceptable | Use `Promise.allSettled` and inspect each outcome |
| Outbound HTTP call without timeout | Add `signal: AbortSignal.timeout(ms)` |
| Retrying 400/401/404 errors | Only retry transient failures (503, 429, network errors) |
| Array fields in schema without `maxItems` | Add `maxItems` to all array fields |
| Trusting `parseInt`/`Number` without range validation | Validate parsed numbers are finite and within expected bounds |

## AI Validation

When AI creates or updates backend code, it MUST verify:

1. No `as` type assertions or unguarded `!` operators
2. All `JSON.parse` calls on external data are wrapped in try/catch
3. All string fields in schemas have `maxLength` and all array fields have `maxItems` constraints
4. All HTTP endpoints have auth middleware (or a documented reason for omission)
5. HTTP status codes are semantically correct (especially 401 vs 403)
6. All logging uses structured `logger`, never `console.log`
7. All config access goes through the `config` component, never `process.env`
8. Guards are applied consistently across similar code paths
9. HTTP handlers use a single try-catch wrapper — no scattered early returns with manual status/body construction
10. No sensitive data (passwords, tokens, secrets) in log output
11. All SQL queries use parameterized placeholders — no string interpolation
12. Multi-step DB mutations are wrapped in a transaction
13. No N+1 query patterns — related data is batch-loaded
14. No floating promises — every async call is `await`ed or has `.catch()` with a comment
15. No `forEach` with async callbacks — use `Promise.all(map(...))` or `for...of`
16. All outbound HTTP calls have an explicit timeout (`AbortSignal.timeout()`)
17. Request schema is validated at the service boundary, not scattered through business logic
18. Query parameter and env var parsing includes explicit type validation
