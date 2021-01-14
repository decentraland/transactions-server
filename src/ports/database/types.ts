import { IDatabase } from '@well-known-components/interfaces'
import { Database } from 'sqlite'

export interface IDatabaseComponent extends IDatabase {
  query<T>(sql: string): Promise<IDatabase.IQueryResult<T>>
  query<T>(sql: string, ...values: any[]): Promise<IDatabase.IQueryResult<T>>
  run(sql: string, ...values: any[]): Promise<number | undefined>

  start: () => Promise<void>
  stop: () => Promise<void>

  migrate: Database['migrate']
}
