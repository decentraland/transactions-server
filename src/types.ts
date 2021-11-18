import { IFetchComponent } from '@well-known-components/http-server'
import type {
  IConfigComponent,
  ILoggerComponent,
  IHttpServerComponent,
  IBaseComponent,
  IMetricsComponent,
} from '@well-known-components/interfaces'
import { metricDeclarations } from './metrics'
import { IDatabaseComponent } from './ports/database/types'
import { ISubgraphComponent } from './ports/subgraph/types'
import { ITestFetchComponent } from './ports/fetcher'

export type GlobalContext = {
  components: AppComponents
}

export type BaseComponents = {
  config: IConfigComponent
  logs: ILoggerComponent
  globalLogger: ILoggerComponent.ILogger
  fetcher: IFetchComponent
  metrics: IMetricsComponent<keyof typeof metricDeclarations>
  database: IDatabaseComponent
  server: IHttpServerComponent<GlobalContext>
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
