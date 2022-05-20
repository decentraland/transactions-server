import { IMetricsComponent } from '@well-known-components/interfaces'
import { validateMetricsDeclaration } from '@well-known-components/metrics'
import { metricDeclarations as thegraphMetrics } from '@well-known-components/thegraph-component'

export const metricDeclarations = {
  dcl_error_sale_price_too_low: {
    help: 'The transaction sale price trying to be executed is too low',
    type: IMetricsComponent.CounterType,
    labelNames: ['contract', 'minPrice', 'salePrice'],
  },
  dcl_sent_transactions_biconomy: {
    help: 'Count transactions sent to BICONOMY',
    type: IMetricsComponent.CounterType,
    labelNames: ['contract'],
  },
  dcl_error_limit_reached_transactions_biconomy: {
    help: 'Count limit errors when trying to relay a transaction to BICONOMY',
    type: IMetricsComponent.CounterType,
    labelNames: ['contract', 'code'],
  },
  dcl_error_cannot_estimate_gas_transactions_biconomy: {
    help: 'Count errors of cannot estimate gas when trying to relay a transaction to BICONOMY',
    type: IMetricsComponent.CounterType,
    labelNames: ['contract'],
  },
  dcl_error_relay_transactions_biconomy: {
    help: 'Count errors of BICONOMY Api when trying to relay a transaction to BICONOMY',
    type: IMetricsComponent.CounterType,
    labelNames: ['contract'],
  },
  ...thegraphMetrics,
}

// type assertions
validateMetricsDeclaration(metricDeclarations)
