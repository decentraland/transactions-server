import type { IFeaturesComponent } from '@well-known-components/features-component'
import type { IFetchComponent } from '@well-known-components/http-server'
import type {
  IBaseComponent,
  IConfigComponent,
  IHttpServerComponent,
  ILoggerComponent,
  IMetricsComponent,
} from '@well-known-components/interfaces'
import type { IPgComponent } from '@well-known-components/pg-component'
import type { ISubgraphComponent } from '@well-known-components/thegraph-component'
import type { metricDeclarations } from './metrics'
import type { IContractsComponent } from './ports/contracts/types'
import type { ITestFetchComponent } from './ports/fetcher'
import type { GelatoMetaTransactionComponent } from './ports/gelato'
import type { OpenZeppelinMetaTransactionComponent } from './ports/openzeppelin'
import type { IRelayRouterComponent } from './ports/relay-router/types'
import type { ITransactionComponent } from './ports/transaction/types'

export interface GlobalContext {
  components: AppComponents
}

export interface BaseComponents {
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
export type TestComponents = Omit<BaseComponents, 'fetcher'> & {
  fetcher: ITestFetchComponent
}

// Production components
export type AppComponents = BaseComponents

export type HandlerContextWithPath<
  ComponentNames extends keyof AppComponents,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- default Path widened to any to match how callers conventionally specify untyped paths in @well-known-components handlers
  Path extends string = any,
> = IHttpServerComponent.PathAwareContext<
  IHttpServerComponent.DefaultContext<{
    components: Pick<AppComponents, ComponentNames>
  }>,
  Path
>

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see HandlerContextWithPath above
export type Context<Path extends string = any> =
  IHttpServerComponent.PathAwareContext<GlobalContext, Path>
