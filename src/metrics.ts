import { IMetricsComponent } from '@well-known-components/interfaces'
import { validateMetricsDeclaration } from '@well-known-components/metrics'
import { metricDeclarations as thegraphMetrics } from '@well-known-components/thegraph-component'

export const metricDeclarations = {
  dcl_error_sale_price_too_low: {
    help: 'The transaction sale price trying to be executed is too low',
    type: IMetricsComponent.CounterType,
    labelNames: ['minPrice', 'salePrice'],
  },
  // Biconomy metrics
  dcl_sent_transactions_biconomy: {
    help: 'Count transactions sent to BICONOMY',
    type: IMetricsComponent.CounterType,
    labelNames: [],
  },
  dcl_error_limit_reached_transactions_biconomy: {
    help: 'Count limit errors when trying to relay a transaction to BICONOMY',
    type: IMetricsComponent.CounterType,
    labelNames: ['code'],
  },
  dcl_error_cannot_estimate_gas_transactions_biconomy: {
    help: 'Count errors of cannot estimate gas when trying to relay a transaction to BICONOMY',
    type: IMetricsComponent.CounterType,
    labelNames: [],
  },
  dcl_error_relay_transactions_biconomy: {
    help: 'Count errors of BICONOMY Api when trying to relay a transaction to BICONOMY',
    type: IMetricsComponent.CounterType,
    labelNames: [],
  },
  // Gelato metrics
  dcl_sent_transactions_gelato: {
    help: 'Count transactions sent to Gelato',
    type: IMetricsComponent.CounterType,
    labelNames: [],
  },
  dcl_error_cancelled_transactions_gelato: {
    help: 'Count transactions cancelled by Gelato',
    type: IMetricsComponent.CounterType,
    labelNames: [],
  },
  dcl_error_reverted_transactions_gelato: {
    help: 'Count transactions reverted by Gelato',
    type: IMetricsComponent.CounterType,
    labelNames: [],
  },
  dcl_error_service_errors_gelato: {
    help: 'Count service errors when trying to relay a transaction to Gelato',
    type: IMetricsComponent.CounterType,
    labelNames: [],
  },
  dcl_error_timeout_gelato: {
    help: 'Count timeout errors when trying to get the status of a relayed transaction to Gelato',
    type: IMetricsComponent.CounterType,
    labelNames: [],
  },
  dcl_error_no_balance_transactions_gelato: {
    help: 'Count errors of no balance when trying to relay a transaction to Gelato',
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
