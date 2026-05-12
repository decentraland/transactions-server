import SQL from 'sql-template-strings'
import type { IDatabase } from '@well-known-components/interfaces'
import {
  checkContractAddress,
  checkFunctionSelector,
  checkGasPrice,
  checkQuota,
  checkSalePrice,
  checkSchema,
  checkTransaction,
} from './validation'
import { QuotaReachedError } from '../../types/transactions/errors'
import type { ITransactionComponent, TransactionRow } from './types'
import type { AppComponents } from '../../types'
import type { TransactionData } from '../../types/transactions/transactions'

export function createTransactionComponent(
  components: Pick<
    AppComponents,
    | 'config'
    | 'pg'
    | 'contracts'
    | 'features'
    | 'fetcher'
    | 'logs'
    | 'metrics'
    | 'relayer'
  >
): ITransactionComponent {
  const { config, relayer, pg } = components

  async function sendMetaTransaction(
    transactionData: TransactionData
  ): Promise<string> {
    return relayer.sendMetaTransaction(transactionData)
  }

  async function reserveQuota(
    userAddress: string,
    sessionId: string
  ): Promise<void> {
    const maxTransactionsPerDay = await config.requireNumber(
      'MAX_TRANSACTIONS_PER_DAY'
    )

    const pool = pg.getPool()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        userAddress,
      ])

      const countResult = await client.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count
         FROM transactions
         WHERE user_address = $1
           AND created_at >= NOW() - INTERVAL '1 day'`,
        [userAddress]
      )
      const count = Number(countResult.rows[0].count)

      if (count >= maxTransactionsPerDay) {
        await client.query('ROLLBACK')
        throw new QuotaReachedError(userAddress, count)
      }

      await client.query(
        `INSERT INTO transactions (user_address, session_id) VALUES ($1, $2)`,
        [userAddress, sessionId]
      )
      await client.query('COMMIT')
    } catch (error) {
      try {
        await client.query('ROLLBACK')
      } catch {
        // ignore — preserve the original error
      }
      throw error
    } finally {
      client.release()
    }
  }

  async function confirmReservation(
    sessionId: string,
    txHash: string
  ): Promise<void> {
    await pg.query(SQL`
      UPDATE transactions SET tx_hash = ${txHash}, session_id = NULL
      WHERE session_id = ${sessionId}
    `)
  }

  async function releaseReservation(sessionId: string): Promise<void> {
    await pg.query(SQL`
      DELETE FROM transactions WHERE session_id = ${sessionId}
    `)
  }

  async function getByUserAddress(
    userAddress: string
  ): Promise<IDatabase.IQueryResult<TransactionRow>> {
    return pg.query<TransactionRow>(
      SQL`SELECT id, tx_hash, user_address, created_at
          FROM transactions
          WHERE user_address = ${userAddress}
            AND tx_hash IS NOT NULL`
    )
  }

  async function checkData(transactionData: TransactionData): Promise<void> {
    await checkSchema(components, transactionData)
    await checkFunctionSelector(components, transactionData)
    await checkContractAddress(components, transactionData)
    await checkQuota(components, transactionData)
    await checkGasPrice(components, transactionData)
    await checkTransaction(components, transactionData)
    await checkSalePrice(components, transactionData)
  }

  return {
    sendMetaTransaction,
    reserveQuota,
    confirmReservation,
    releaseReservation,
    getByUserAddress,
    checkData,
  }
}
