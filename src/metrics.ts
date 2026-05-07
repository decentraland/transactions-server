import { IMetricsComponent } from '@well-known-components/interfaces'
import { validateMetricsDeclaration } from '@well-known-components/metrics'
import { metricDeclarations as thegraphMetrics } from '@well-known-components/thegraph-component'

export const metricDeclarations = {
  dcl_error_sale_price_too_low: {
    help: 'The transaction sale price trying to be executed is too low',
    type: IMetricsComponent.CounterType,
    labelNames: ['minPrice', 'salePrice'],
  },
  dcl_error_invalid_function_selector: {
    help: 'Count transactions rejected because the calldata does not invoke executeMetaTransaction',
    type: IMetricsComponent.CounterType,
    labelNames: [],
  },
  dcl_error_self_relay_user_address: {
    help: 'Count transactions rejected because the meta-tx userAddress matches one of our relayer EOAs (self-relay)',
    type: IMetricsComponent.CounterType,
    labelNames: [],
  },
  dcl_error_relayer_addresses_refresh_failed: {
    help: 'Count failures while refreshing the cached set of relayer EOAs from the OpenZeppelin Relayer API',
    type: IMetricsComponent.CounterType,
    labelNames: [],
  },
  // Per-relayer metrics. The `relayer` label takes one of the values from
  // `ProviderName` ('gelato' | 'openzeppelin') — see src/ports/relay-router/types.ts.
  dcl_sent_transactions: {
    help: 'Count transactions sent to a relayer',
    type: IMetricsComponent.CounterType,
    labelNames: ['relayer'],
  },
  dcl_error_cancelled_transactions: {
    help: 'Count transactions cancelled by a relayer',
    type: IMetricsComponent.CounterType,
    labelNames: ['relayer'],
  },
  dcl_error_reverted_transactions: {
    help: 'Count transactions reverted by a relayer',
    type: IMetricsComponent.CounterType,
    labelNames: ['relayer'],
  },
  dcl_error_service_errors: {
    help: 'Count service errors when trying to relay a transaction',
    type: IMetricsComponent.CounterType,
    labelNames: ['relayer'],
  },
  dcl_error_timeout: {
    help: 'Count timeout errors when waiting for a transaction status from a relayer',
    type: IMetricsComponent.CounterType,
    labelNames: ['relayer'],
  },
  dcl_error_no_balance_transactions: {
    help: 'Count errors caused by a relayer running out of balance',
    type: IMetricsComponent.CounterType,
    labelNames: ['relayer'],
  },
  dcl_error_high_gas_price: {
    help: 'Count transactions rejected because the network gas price exceeds the allowed limit',
    type: IMetricsComponent.CounterType,
    labelNames: [],
  },
  dcl_error_simulate_transaction: {
    help: 'Count errors of simulate transaction',
    type: IMetricsComponent.CounterType,
    labelNames: [],
  },
  ...thegraphMetrics,
}

// type assertions
validateMetricsDeclaration(metricDeclarations)
