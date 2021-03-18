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

export type AppConfig = {
  HTTP_SERVER_PORT: string
  HTTP_SERVER_HOST: string
  API_VERSION: string
  BICONOMY_API_URL: string
  BICONOMY_API_KEY: string
  BICONOMY_API_ID: string
}

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
}

// Test components
export type TestComponents = BaseComponents & {}

// Production components
export type AppComponents = BaseComponents & {
  statusChecks: IBaseComponent
}

export type HandlerContextWithPath<
  ComponentNames extends keyof AppComponents,
  Path extends string = any
> = IHttpServerComponent.PathAwareContext<
  IHttpServerComponent.DefaultContext<{
    components: Pick<AppComponents, ComponentNames>
  }>,
  Path
>

export type Context<
  Path extends string = any
> = IHttpServerComponent.PathAwareContext<GlobalContext, Path>
