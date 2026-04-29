# Well-Known Components - Detailed Reference

## Complete Component Implementation Example

```typescript
// types/components.ts
/**
 * User management component interface
 */
export interface IUserComponent extends IBaseComponent {
  /**
   * Retrieves a user by their unique identifier
   *
   * @param id - The unique identifier of the user
   * @returns Promise resolving to the user object
   * @throws {UserNotFoundError} If the user does not exist
   */
  getUser: (id: string) => Promise<User>

  /**
   * Creates a new user with the provided data
   *
   * @param data - User creation data including email and name
   * @returns Promise resolving to the created user object
   * @throws {ValidationError} If user data is invalid
   * @throws {DuplicateUserError} If a user with the same email already exists
   */
  createUser: (data: CreateUserData) => Promise<User>

  /**
   * Updates an existing user with new data
   *
   * @param id - The unique identifier of the user to update
   * @param data - User update data containing fields to modify
   * @returns Promise resolving to the updated user object
   * @throws {UserNotFoundError} If the user does not exist
   * @throws {ValidationError} If update data is invalid
   */
  updateUser: (id: string, data: UpdateUserData) => Promise<User>

  /**
   * Deletes a user by their unique identifier
   *
   * @param id - The unique identifier of the user to delete
   * @returns Promise resolving when deletion is complete
   * @throws {UserNotFoundError} If the user does not exist
   */
  deleteUser: (id: string) => Promise<void>
}
```

```typescript
// src/logic/user/user.ts
import { IBaseComponent, START_COMPONENT, STOP_COMPONENT } from '@well-known-components/interfaces'
import { IUserComponent } from './types'
import { UserNotFoundError } from './errors'

/**
 * Creates the User component
 *
 * Orchestrates user management operations:
 * 1. Validates user data and permissions
 * 2. Interacts with database for CRUD operations
 * 3. Logs all user-related activities
 * 4. Tracks performance metrics for user operations
 *
 * @param components Required components: database, logs, metrics
 * @returns IUserComponent implementation
 */
export async function createUserComponent(
  components: Pick<AppComponents, 'database' | 'logs' | 'metrics'>
): Promise<IUserComponent> {
  const { database, logs, metrics } = components
  const logger = logs.getLogger('user-component')

  return {
    /**
     * Retrieves a user by their unique identifier
     *
     * This method MUST validate the user exists before returning.
     * All database queries are logged for audit purposes and tracked with metrics.
     *
     * @param id - The unique identifier of the user
     * @returns The user object if found
     * @throws {UserNotFoundError} If the user with the given id does not exist
     */
    async getUser(id: string): Promise<User> {
      const timer = metrics.startTimer('user_get_duration')
      try {
        logger.debug('Fetching user', { userId: id })
        const user = await database.query('SELECT * FROM users WHERE id = $1', [id])
        if (!user) {
          throw new UserNotFoundError(`User with id ${id} not found`)
        }
        return user
      } finally {
        timer()
      }
    },

    /**
     * Creates a new user with the provided data
     *
     * @param data - User creation data including email and name
     * @returns The created user object
     * @throws {ValidationError} If user data is invalid
     * @throws {DuplicateUserError} If a user with the same email already exists
     */
    async createUser(data: CreateUserData): Promise<User> {
      logger.info('Creating user', { email: data.email })
      const user = await database.query(
        'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *',
        [data.email, data.name]
      )
      return user
    },

    /**
     * Updates an existing user with new data
     *
     * @param id - The unique identifier of the user to update
     * @param data - User update data containing fields to modify
     * @returns The updated user object
     * @throws {UserNotFoundError} If the user with the given id does not exist
     */
    async updateUser(id: string, data: UpdateUserData): Promise<User> {
      logger.info('Updating user', { userId: id })
      const user = await database.query(
        'UPDATE users SET name = $1 WHERE id = $2 RETURNING *',
        [data.name, id]
      )
      if (!user) {
        throw new UserNotFoundError(`User with id ${id} not found`)
      }
      return user
    },

    /**
     * Deletes a user by their unique identifier
     *
     * @param id - The unique identifier of the user to delete
     * @throws {UserNotFoundError} If the user with the given id does not exist
     */
    async deleteUser(id: string): Promise<void> {
      logger.info('Deleting user', { userId: id })
      await database.query('DELETE FROM users WHERE id = $1', [id])
    }
  }
}

// src/logic/user/index.ts
export { createUserComponent } from './user'
export type { IUserComponent } from './types'
```

## Directory Structure Reference

```
src/
├── adapters/           # External service integrations
│   ├── postgres.ts     # PostgreSQL adapter
│   ├── redis.ts        # Redis adapter
│   ├── s3.ts           # S3 adapter
│   └── rpc-server/     # RPC server adapter
├── logic/              # Business logic components
│   ├── user/
│   │   ├── component.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── job/
│   │   ├── component.ts
│   │   └── index.ts
│   └── notifications/
├── controllers/        # Request/response handling
│   └── handlers/
│       ├── users.ts
│       └── health.ts
├── types/
│   ├── components.ts   # All component interfaces
│   └── system.ts       # System-wide types
├── components.ts       # Main component wiring
└── docs/
    └── openapi.yaml    # API documentation
```

## Error Handling Pattern

```typescript
/**
 * Creates the User component with proper error handling
 *
 * @param components Required components: database, logs
 * @returns IUserComponent implementation
 */
export async function createUserComponent(
  components: Pick<AppComponents, 'database' | 'logs'>
): Promise<IUserComponent> {
  const { database, logs } = components
  const logger = logs.getLogger('user-component')

  return {
    /**
     * Retrieves a user by their unique identifier
     *
     * @param id - The unique identifier of the user
     * @returns The user object if found
     * @throws {UserNotFoundError} If the user with the given id does not exist
     * @throws {DatabaseError} If a database error occurs during the query
     */
    async getUser(id: string): Promise<User> {
      try {
        const user = await database.query('SELECT * FROM users WHERE id = $1', [id])
        if (!user) {
          throw new UserNotFoundError(`User with id ${id} not found`)
        }
        return user
      } catch (error) {
        logger.error('Error fetching user', { userId: id, error })
        throw error
      }
    }
  }
}
```

## JSDoc Documentation Patterns

### Factory Function Documentation

```typescript
/**
 * Creates the Component
 *
 * Orchestrates operations:
 * 1. Step one
 * 2. Step two
 * 3. Step three
 *
 * @param components Required components: dep1, dep2
 * @returns IComponent implementation
 */
```

### Method Documentation

```typescript
/**
 * Brief description of what the method does
 *
 * Additional context about behavior, preconditions, or side effects.
 *
 * @param paramName - Description of the parameter
 * @returns Description of the return value
 * @throws {ErrorType} When this error occurs
 */
```

### Complex Method Documentation

```typescript
/**
 * Validates operation parameters and prepares result metadata
 *
 * This method MUST be called before executing the operation.
 *
 * The validation process:
 * 1. Validates input format and required fields
 * 2. Checks authorization and permissions
 * 3. Verifies resource existence and state
 * 4. Prepares response metadata structure
 *
 * @param params - Operation parameters containing identifier and options
 * @returns Prepared metadata object with validation results
 * @throws {ValidationError} If input parameters are invalid
 * @throws {UnauthorizedError} If user lacks required permissions
 * @throws {NotFoundError} If the referenced resource does not exist
 */
```

## Validation Checklist

- [ ] Component extends `IBaseComponent` interface
- [ ] Factory function follows `create*Component` naming convention
- [ ] Dependencies declared using `Pick<AppComponents, ...>`
- [ ] Proper async patterns implemented
- [ ] Error handling includes logging and typed errors
- [ ] Lifecycle methods (`START_COMPONENT`, `STOP_COMPONENT`) implemented when needed
- [ ] Component organized in appropriate directory (`adapters/` or `logic/`)
- [ ] Interface defined in `types/components.ts`
- [ ] Single responsibility maintained
- [ ] Dependencies minimal and non-circular
- [ ] Resource cleanup handled in stop methods
- [ ] Factory function has comprehensive JSDoc
- [ ] All public methods have JSDoc with `@param`, `@returns`, `@throws`
- [ ] Interface methods have JSDoc documentation
- [ ] HTTP endpoints documented in `docs/openapi.yaml`
