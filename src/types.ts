import { IFetchComponent } from '@well-known-components/http-server'
import { ISubgraphComponent } from '@well-known-components/thegraph-component'
import type {
  IConfigComponent,
  ILoggerComponent,
  IHttpServerComponent,
  IBaseComponent,
  IMetricsComponent,
} from '@well-known-components/interfaces'
import { metricDeclarations } from './metrics'
import { IPgComponent } from '@well-known-components/pg-component'
import { ITestFetchComponent } from './ports/fetcher'
import { IContractsComponent } from './ports/contracts/types'
import { ITransactionComponent } from './ports/transaction/types'
import { IFeaturesComponent } from './ports/features'

export type GlobalContext = {
  components: AppComponents
}

export type BaseComponents = {
  config: IConfigComponent
  logs: ILoggerComponent
  globalLogger: ILoggerComponent.ILogger
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
  Path extends string = any
> = IHttpServerComponent.PathAwareContext<
  IHttpServerComponent.DefaultContext<{
    components: Pick<AppComponents, ComponentNames>
  }>,
  Path
>

export type Context<Path extends string = any> =
  IHttpServerComponent.PathAwareContext<GlobalContext, Path>
