import { MigrationBuilder } from 'node-pg-migrate'

const tableName = 'transactions'
const userCreatedIndexName = 'idx_transactions_user_created'

export async function up(pgm: MigrationBuilder): Promise<void> {
  // CREATE INDEX CONCURRENTLY cannot run inside a transaction block, so the
  // whole migration runs without the wrapping transaction. The ALTERs below
  // are simple metadata operations and won't fail mid-way.
  pgm.noTransaction()

  pgm.alterColumn(tableName, 'tx_hash', { notNull: false })
  pgm.addColumns(tableName, {
    session_id: { type: 'TEXT', unique: true },
  })
  pgm.createIndex(tableName, ['user_address', 'created_at'], {
    name: userCreatedIndexName,
    concurrently: true,
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.noTransaction()

  pgm.dropIndex(tableName, ['user_address', 'created_at'], {
    name: userCreatedIndexName,
    concurrently: true,
    ifExists: true,
  })
  pgm.dropColumns(tableName, ['session_id'])
  pgm.alterColumn(tableName, 'tx_hash', { notNull: true })
}
