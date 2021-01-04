import { server } from 'decentraland-server'

import { Router } from '../common/Router'

export class AppRouter extends Router {
  mount() {
    this.router.get('/status', server.handleRequest(this.getStatus))
  }

  getStatus() {
    return {
      status: 'ok'
    }
  }
}
