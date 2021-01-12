import { RoutedContext } from '@well-known-components/http-server'
import type {
  IConfigComponent,
  ILoggerComponent,
  IHttpServerComponent,
  IBaseComponent,
} from '@well-known-components/interfaces'

export type AppConfig = {
  HTTP_SERVER_PORT: string
  HTTP_SERVER_HOST: string
  API_VERSION: string
}

export type AppComponents<C extends object = {}> = {
  config: IConfigComponent
  logs: ILoggerComponent
  server: IHttpServerComponent<C>
  statusChecks: IBaseComponent
}

export type GlobalContext = {
  components: AppComponents
}

export type Context<Path extends string = any> = RoutedContext<{}, Path>
