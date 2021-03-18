import { Lifecycle } from '@well-known-components/interfaces'
import { main } from './service'
import { initComponents } from './components'

// This file is the program entry point, it only calls the Lifecycle function
Lifecycle.programEntryPoint({ main, initComponents }).catch()
