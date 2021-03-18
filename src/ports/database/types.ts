import { IBaseComponent, IDatabase } from '@well-known-components/interfaces'
import { SQLStatement } from 'sql-template-strings'
import { Database } from 'sqlite'

export interface IDatabaseComponent extends IDatabase, IBaseComponent {
  query<T>(sql: SQLStatement): Promise<IDatabase.IQueryResult<T>>
  query<T>(sql: string): Promise<IDatabase.IQueryResult<T>>
  run(sql: string, ...values: any[]): Promise<number | undefined>

  migrate: Database['migrate']
}
