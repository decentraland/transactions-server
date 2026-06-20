import { IFetchComponent, IHttpServerComponent } from '@dcl/core-commons'
import { ISubgraphComponent } from '@dcl/thegraph-component'
import type {
  IConfigComponent,
  ILoggerComponent,
  IBaseComponent,
  IMetricsComponent,
} from '@well-known-components/interfaces'
import { IFeaturesComponent } from '@dcl/features-component'
import { IPgComponent } from '@dcl/pg-component'
import { metricDeclarations } from './metrics'
import { IContractsComponent } from './ports/contracts/types'
import { ITransactionComponent } from './ports/transaction/types'
import { GelatoMetaTransactionComponent } from './ports/gelato'
import { OpenZeppelinMetaTransactionComponent } from './ports/openzeppelin'
import { IRelayRouterComponent } from './ports/relay-router/types'

export type GlobalContext = {
  components: AppComponents
}

export type BaseComponents = {
  config: IConfigComponent
  logs: ILoggerComponent
  globalLogger: ILoggerComponent.ILogger
  relayer: IRelayRouterComponent
  gelato?: GelatoMetaTransactionComponent
  openzeppelin?: OpenZeppelinMetaTransactionComponent
  features: IFeaturesComponent
  fetcher: IFetchComponent
  metrics: IMetricsComponent<keyof typeof metricDeclarations>
  pg: IPgComponent
  server: IHttpServerComponent<GlobalContext>
  transaction: ITransactionComponent
  contracts: IContractsComponent
  collectionsSubgraph: ISubgraphComponent
  statusChecks: IBaseComponent
}

// Test components
export type TestComponents = BaseComponents

// Production components
export type AppComponents = BaseComponents

export type HandlerContextWithPath<
  ComponentNames extends keyof AppComponents,
  Path extends string = any
> = IHttpServerComponent.PathAwareContext<
  IHttpServerComponent.DefaultContext<{
    components: Pick<AppComponents, ComponentNames>
  }>,
  Path
>

export type Context<Path extends string = any> =
  IHttpServerComponent.PathAwareContext<GlobalContext, Path>
