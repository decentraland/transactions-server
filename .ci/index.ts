import * as pulumi from '@pulumi/pulumi'
import { createFargateTask } from 'dcl-ops-lib/createFargateTask'
import { createImageFromContext } from 'dcl-ops-lib/createImageFromContext'
import { env, envTLD } from 'dcl-ops-lib/domain'

const prometheusStack = new pulumi.StackReference(`prometheus-${env}`)

export = async function main() {
  const config = new pulumi.Config()
  const ecrRegistryImage = createImageFromContext(
    'transactions-server',
    '..',
    {}
  )

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
      {
        name: 'CHAIN_NAME',
        value: env === 'prd' || env === 'stg' ? 'Ethereum Mainnet' : 'Ropsten',
      },
      { name: 'MAX_TRANSACTIONS_PER_DAY', value: '1000' },
      {
        name: 'CONTRACT_ADDRESSES_URL',
        value: 'https://contracts.decentraland.org/addresses.json',
      },
      {
        name: 'COLLECTIONS_SUBGRAPH_URL',
        value:
          env === 'prd' || env === 'stg'
            ? 'https://api.thegraph.com/subgraphs/name/decentraland/collections-matic-mainnet'
            : 'https://api.thegraph.com/subgraphs/name/decentraland/collections-matic-mumbai',
      },
      {
        name: 'COLLECTIONS_CHAIN_ID',
        value: env === 'prd' || env === 'stg' ? '137' : '80001',
      },
      {
        name: 'COLLECTIONS_FETCH_INTERVAL_MS',
        value: '3600000',
      },
      {
        name: 'MIN_SALE_VALUE_IN_WEI',
        value: '0000000000000000000',
      },
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
      {
        name: 'WKC_METRICS_BEARER_TOKEN',
        value: prometheusStack.getOutput('serviceMetricsBearerToken'),
      },
    ],
    hostname,
    {
      // @ts-ignore
      healthCheck: {
        path: '/health/ready',
        interval: 20,
        timeout: 10,
        unhealthyThreshold: 10,
        healthyThreshold: 3,
      },
      metrics: {
        path: '/metrics',
      },
      version: '2',
      memoryReservation: 1024,
      extraExposedServiceOptions: {
        createCloudflareProxiedSubdomain: true,
      },
      desiredCount: env === 'prd' ? 3 : 1,
    }
  )

  const publicUrl = transactionsAPI.endpoint

  return {
    publicUrl,
  }
}
