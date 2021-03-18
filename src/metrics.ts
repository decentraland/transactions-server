import { IMetricsComponent } from '@well-known-components/interfaces'
import { validateMetricsDeclaration } from '@well-known-components/metrics'

export const metricDeclarations = {
  dcl_sent_transactions_biconomy: {
    help: 'Count transactions sent to BICONOMY',
    type: IMetricsComponent.CounterType,
    labelNames: ['contract'],
  },
  dcl_sent_amount_biconomy: {
    help: 'Count transactions sent to BICONOMY',
    type: IMetricsComponent.CounterType,
    labelNames: ['contract', 'amount'],
  },
}

// type assertions
validateMetricsDeclaration(metricDeclarations)
