import { runBaseTests, setupEnvironment } from './base'
import workerInit from './init-threads'

workerInit({ runTests: runBaseTests, setup: setupEnvironment })
