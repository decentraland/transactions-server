import { MigrationBuilder } from 'node-pg-migrate'

const tableName = 'transactions'
const userCreatedIndexName = 'idx_transactions_user_created'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.alterColumn(tableName, 'tx_hash', { notNull: false })
  pgm.addColumns(tableName, {
    session_id: { type: 'TEXT', unique: true },
  })
  pgm.createIndex(tableName, ['user_address', 'created_at'], {
    name: userCreatedIndexName,
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex(tableName, ['user_address', 'created_at'], {
    name: userCreatedIndexName,
    ifExists: true,
  })
  pgm.dropColumns(tableName, ['session_id'])
  pgm.alterColumn(tableName, 'tx_hash', { notNull: true })
}
