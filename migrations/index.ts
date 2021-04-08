import { Lifecycle } from '@well-known-components/interfaces'
import { createLogComponent } from '@well-known-components/logger'
import { createDatabaseComponent } from '../src/ports/database/component'

Lifecycle.run({
  async main({ components: { db }, startComponents, stop }) {
    // Start DB
    await startComponents()

    // run migrations
    await db.migrate()

    // exit program
    await stop()
  },

  async initComponents() {
    const logs = createLogComponent()
    const db = await createDatabaseComponent(
      { logs },
      { filename: 'database.db' }
    )

    return { logs, db }
  },
})
