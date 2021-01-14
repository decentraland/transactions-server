import { createLogComponent } from '@well-known-components/logger'
import { createDatabaseComponent } from '../src/ports/database/component'

async function migrate() {
  const logs = createLogComponent()
  const db = await createDatabaseComponent({ logs })

  try {
    await db.start()
    await db.migrate()
  } catch (error) {
    // Nothing
  } finally {
    await db.stop()
  }
}

migrate()
  .then(() => console.log('All done'))
  .catch((error) =>
    console.log('An error occurred trying to run migrations', error)
  )
