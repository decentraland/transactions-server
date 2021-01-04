import express = require('express')
import bodyParser = require('body-parser')

export class ExpressApp {
  protected app: express.Application
  protected router: express.Router

  constructor() {
    this.app = express()
    this.router = express.Router()
  }

  useJSON() {
    this.app.use(
      bodyParser.json({ limit: '5mb' })
    )
    return this
  }

  useCORS(origin: string, method: string) {
    const cors = function (_: any, res: express.Response, next: Function) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Request-Method', method)
      res.setHeader(
        'Access-Control-Allow-Methods',
        'OPTIONS, GET, POST, PUT, DELETE'
      )
      res.setHeader('Access-Control-Allow-Headers', '*')
      res.setHeader(
        'Access-Control-Expose-Headers',
        'ETag, Cache-Control, Content-Language, Content-Type, Expires, Last-Modified, Pragma'
      )

      next()
    }
    this.app.use(cors)
    this.router.all('*', cors)
    return this
  }

  useVersion(version: string) {
    this.app.use(`/${version}`, this.router)
    return this
  }

  use(...handers: express.RequestHandler[]) {
    this.app.use(...handers)
    return this
  }

  listen(port: string | number) {
    this.app.listen(port, () => console.log('Server running on port', port))
  }

  getApp() {
    return this.app
  }

  getRouter() {
    return this.router
  }
}
