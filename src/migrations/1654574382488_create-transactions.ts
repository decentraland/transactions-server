import { MigrationBuilder } from 'node-pg-migrate'

const tableName = 'transactions'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(tableName, {
    id: { type: 'SERIAL', primaryKey: true, unique: true, notNull: true },
    tx_hash: { type: 'TEXT', notNull: true, unique: true },
    user_address: { type: 'TEXT', notNull: true },
    created_at: {
      type: 'TIMESTAMP',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(tableName)
}
