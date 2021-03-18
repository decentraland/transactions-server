import sqlite3 from 'sqlite3'
import { SQLStatement } from 'sql-template-strings'
import { open, Database, IMigrate, ISqlite } from 'sqlite'
import { AppComponents } from '../../types'
import { IDatabaseComponent } from './types'

export async function createDatabaseComponent(
  components: Pick<AppComponents, 'logs'>,
  options: { filename: string }
): Promise<IDatabaseComponent> {
  const { logs } = components
  const logger = logs.getLogger('database-component')

  // Config
  let db: Database

  // Methods
  async function start() {
    logger.log('Starting database')
    try {
      db = await open({
        filename: options.filename,
        driver: sqlite3.Database,
      })
    } catch (error) {
      logger.error(
        'An error occurred trying to open the database. Did you run the migrations?'
      )
      throw error
    }
  }

  async function query<T>(sql: string | SQLStatement) {
    logger.debug(`Query SQL: ${sql instanceof SQLStatement ? sql.text : sql}`)
    const rows = await db.all<T[]>(sql)
    return {
      rows,
      rowCount: rows.length,
    }
  }

  async function run(sql: string, ...values: any[]) {
    logger.debug(`Run SQL: ${sql}`)
    const { lastID }: ISqlite.RunResult<sqlite3.Statement> = await db.run(
      sql,
      ...values
    )
    return lastID
  }

  async function migrate(params?: IMigrate.MigrationParams) {
    logger.log('Migrating database')
    await db.migrate(params)
  }

  async function stop() {
    logger.log('Stopping database')
    await db.close()
  }

  return {
    start,
    query,
    run,
    migrate,
    stop,
  }
}
