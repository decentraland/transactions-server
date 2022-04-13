import SQL from 'sql-template-strings'
import { ChainName, ChainId } from '@dcl/schemas'
import { IDatabase } from '@well-known-components/interfaces'
import { getContract, ContractName } from 'decentraland-transactions'
import {
  MetaTransactionErrorCode,
  MetaTransactionRequest,
  MetaTransactionResponse,
  TransactionData,
  TransactionRow,
  transactionSchema,
} from '../types/transaction'
import { AppComponents } from '../types'
import { generateValidator } from './validation'
import {
  decodeFunctionData,
  getMaticChainIdFromNetwork,
  weiToFloat,
} from './ethereum'

export async function sendMetaTransaction(
  components: Pick<AppComponents, 'config' | 'fetcher' | 'metrics'>,
  transactionData: TransactionData
): Promise<string> {
  const {
    config,
    fetcher: { fetch },
    metrics,
  } = components

  const biconomyAPIId = await config.requireString('BICONOMY_API_ID')
  const biconomyAPIKey = await config.requireString('BICONOMY_API_KEY')
  const biconomyAPIURL = await config.requireString('BICONOMY_API_URL')

  const body: MetaTransactionRequest = {
    apiId: biconomyAPIId,
    ...transactionData,
  }

  const result = await fetch(biconomyAPIURL, {
    headers: {
      'x-api-key': biconomyAPIKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    method: 'POST',
  })

  const metricPayload = {
    contract: transactionData.params[0],
  }

  if (!result.ok) {
    const errorMessage = await result.text()
    if (errorMessage.includes('UNPREDICTABLE_GAS_LIMIT')) {
      // This error happens when the contract execution will fail. See https://github.com/decentraland/transactions-server/blob/2e5d833f672a87a7acf0ff761f986421676c4ec9/ERRORS.md
      metrics.increment(
        'dcl_error_cannot_estimate_gas_transactions_biconomy',
        metricPayload
      )
    } else {
      // Any other error is related to the Biconomy API
      metrics.increment('dcl_error_relay_transactions_biconomy', metricPayload)
    }

    throw new MetaTransactionError(
      `An error occurred trying to send the meta transaction. Response: ${errorMessage}.
        ${result.statusText}`
    )
  }

  const data: MetaTransactionResponse = await result.json()

  metrics.increment('dcl_sent_transactions_biconomy', metricPayload)

  return data.txHash!
}

export async function insertTransaction(
  components: Pick<AppComponents, 'database'>,
  row: Omit<TransactionRow, 'id' | 'createdAt'>
) {
  const { database } = components
  await database.run(
    ` INSERT INTO transactions(
        txHash, userAddress
      ) VALUES (
        $txHash, $userAddress
      )
    `,
    {
      $txHash: row.txHash,
      $userAddress: row.userAddress,
    }
  )
}

export async function getByUserAddress(
  components: Pick<AppComponents, 'database'>,
  userAddress: string
): Promise<IDatabase.IQueryResult<TransactionRow>> {
  const { database } = components
  return database.query<TransactionRow>(
    SQL`SELECT *
        FROM transactions
        WHERE userAddress = ${userAddress}`
  )
}

export async function checkTransactionData(
  components: Pick<AppComponents, 'config' | 'contracts' | 'database'>,
  transactionData: TransactionData
) {
  const { config, contracts, database } = components

  const maxTransactionsPerDay = await config.requireNumber(
    'MAX_TRANSACTIONS_PER_DAY'
  )
  const { from, params } = transactionData

  const todayAddressTransactions = await database.query<{ count: number }>(
    SQL`SELECT COUNT (*) as count
        FROM transactions
        WHERE userAddress = ${from}
          AND createdAt >= date('now', 'start of day')`
  )

  const dbResult = todayAddressTransactions.rows[0]
  if (dbResult.count >= maxTransactionsPerDay) {
    throw new Error(`Max amount of transactions reached for address ${from}`)
  }

  const contractAddress = params[0]
  if (!(await contracts.isValidContractAddress(contractAddress))) {
    throw new Error(`Invalid contract address "${contractAddress}"`)
  }

  const minPrice = await config.requireNumber('MIN_SALE_VALUE')
  const chainName = (await config.requireString('CHAIN_NAME')) as ChainName
  const salePrice = getSalePrice(params, getMaticChainIdFromNetwork(chainName))
  if (salePrice !== null && salePrice <= minPrice) {
    throw new Error(
      `The transacation data contains a sale price that's lower that the allowed minimum. Sale: ${salePrice}, Min: ${minPrice}`
    )
  }
}

/**
 * Tries to get the corresponding sale price for the transaction data sent.
 * It'll return a number (converted from wei) if the data corresponds to any of the sales we're watching and null otherwise
 * @param params - Transaction data params
 */
export function getSalePrice(
  params: TransactionData['params'],
  chainId: ChainId
): number | null {
  const [contractAddress, fullData] = params

  const store = getContract(ContractName.CollectionStore, chainId)
  const marketplace = getContract(ContractName.MarketplaceV2, chainId)
  const bid = getContract(ContractName.BidV2, chainId)

  try {
    const { functionSignature: data } = decodeFunctionData(
      store.abi, // Either abi works, we just need one that has the executeMetaTransaction method for the first decode
      'executeMetaTransaction',
      fullData
    )

    switch (contractAddress) {
      case store.address: {
        const [[{ prices }]] = decodeFunctionData(store.abi, 'buy', data)
        const weiPrice = prices[0]
        return weiToFloat(weiPrice)
      }
      case marketplace.address: {
        const { price: weiPrice } = decodeFunctionData(
          marketplace.abi,
          'executeOrder',
          data
        )
        return weiToFloat(weiPrice)
      }
      case bid.address: {
        const { _price: weiPrice } = decodeFunctionData(
          bid.abi,
          'placeBid(address,uint256,uint256,uint256)',
          data
        )
        return weiToFloat(weiPrice)
      }
      default:
        return null
    }
  } catch (error) {
    return null
  }
}

export const validateTrasactionSchema = generateValidator(transactionSchema)

export class MetaTransactionError extends Error {
  code?: MetaTransactionErrorCode

  // For more info on error codes, see https://docs.biconomy.io/api/native-meta-tx
  constructor(message: string, code?: MetaTransactionErrorCode) {
    super(message)
    this.code = code
  }
}
