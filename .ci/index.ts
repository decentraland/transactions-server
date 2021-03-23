import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'
import { createFargateTask } from 'dcl-ops-lib/createFargateTask'
import { createImageFromContext } from "dcl-ops-lib/createImageFromContext"
import { env, envTLD } from 'dcl-ops-lib/domain'

export = async function main() {
  const config = new pulumi.Config()
  const ecrRegistryImage = createImageFromContext("transactions-server", "..", {})

  const hostname = 'transactions-api.decentraland.' + envTLD

  const transactionsAPI = await createFargateTask(
    `transactions-api`,
    ecrRegistryImage.image.imageName,
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
      {
        name: 'BICONOMY_API_KEY',
        value: config.requireSecret('BICONOMY_API_KEY'),
      },
      {
        name: 'BICONOMY_API_ID',
        value: config.requireSecret('BICONOMY_API_ID'),
      },
    ],
    hostname,
    {
      // @ts-ignore
      healthCheck: {
        path: '/health/ready',
        interval: 10,
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
