import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'
import { createFargateTask } from 'dcl-ops-lib/createFargateTask'
import { env, envTLD } from 'dcl-ops-lib/domain'

export = async function main() {
  const revision = process.env['CI_COMMIT_SHA']
  const image = `decentraland/transactions-server:${revision}`

  const hostname = 'transactions-api.decentraland.' + envTLD

  const transactionsAPI = await createFargateTask(
    `transactions-api`,
    image,
    5000,
    [
      { name: 'hostname', value: `transactions-server-${env}` },
      { name: 'name', value: `transactions-server-${env}` },
      { name: 'NODE_ENV', value: 'production' },
      { name: 'API_VERSION', value: 'v1' },
      { name: 'SERVER_PORT', value: '5000' },
      { name: 'CORS_ORIGIN', value: '*' },
      { name: 'CORS_METHOD', value: '*' },
      { name: 'MAX_TRANSACTIONS_PER_DAY', value: '1000' },
      {
        name: 'BICONOMY_API_URL',
        value: 'https://api.biconomy.io/api/v2/meta-tx/native',
      },
    ],
    hostname,
    {
      // @ts-ignore
      healthCheck: {
        path: '/v1/status',
        interval: 60,
        timeout: 10,
        unhealthyThreshold: 10,
        healthyThreshold: 3,
      },
      version: '1',
      memoryReservation: 1024,
    }
  )

  const publicUrl = transactionsAPI.endpoint

  return {
    publicUrl,
  }
}
