/* eslint-disable @typescript-eslint/naming-convention */
import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate'

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('transactions', {
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
  pgm.dropTable('transactions')
}
