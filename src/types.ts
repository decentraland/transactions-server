import { RoutedContext } from '@well-known-components/http-server'
import type {
  IConfigComponent,
  ILoggerComponent,
  IHttpServerComponent,
  IBaseComponent,
} from '@well-known-components/interfaces'
import { ITransactionComponent } from './ports/transaction/types'
import { IValidationComponent } from './ports/validation/types'

export type AppConfig = {
  HTTP_SERVER_PORT: string
  HTTP_SERVER_HOST: string
  API_VERSION: string
  BICONOMY_API_URL: string
  BICONOMY_API_KEY: string
  BICONOMY_API_ID: string
}

export type AppComponents<C extends object = {}> = {
  config: IConfigComponent
  logs: ILoggerComponent
  server: IHttpServerComponent<C>
  transaction: ITransactionComponent
  validation: IValidationComponent
  statusChecks: IBaseComponent
}

export type GlobalContext = {
  components: AppComponents
}

export type Context<Path extends string = any> = RoutedContext<{}, Path>
