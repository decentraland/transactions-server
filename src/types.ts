import { RoutedContext } from '@well-known-components/http-server'
import type {
  IConfigComponent,
  ILoggerComponent,
  IHttpServerComponent,
  IBaseComponent,
} from '@well-known-components/interfaces'
import { IDatabaseComponent } from './ports/database/types'
import { ITransactionComponent } from './ports/transaction/types'

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

export type AppComponents = {
  config: IConfigComponent
  logs: ILoggerComponent
  database: IDatabaseComponent
  server: IHttpServerComponent<GlobalContext>
  transaction: ITransactionComponent
  statusChecks: IBaseComponent
}

export type Context<Path extends string = any> = RoutedContext<
  GlobalContext,
  Path
>
