import { IMetricsComponent } from '@well-known-components/interfaces'
import { validateMetricsDeclaration } from '@well-known-components/metrics'

export const metricDeclarations = {
  dcl_sent_transactions_biconomy: {
    help: 'Count transactions sent to BICONOMY',
    type: IMetricsComponent.CounterType,
    labelNames: ['contract'],
  },
  dcl_error_cannot_estimate_gas_transactions_biconomy: {
    help: 'Count errors of cannot estimate gas when trying to relay a transaction to BICONOMY',
    type: IMetricsComponent.CounterType,
    labelNames: ['contract', 'data', 'from'],
  },
  dcl_error_relay_transactions_biconomy: {
    help: 'Count errors of BICONOMY Api when trying to relay a transaction to BICONOMY',
    type: IMetricsComponent.CounterType,
    labelNames: ['contract', 'data', 'from'],
  },
}

// type assertions
validateMetricsDeclaration(metricDeclarations)
