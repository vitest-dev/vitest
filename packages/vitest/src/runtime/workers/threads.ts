import { runBaseTests, setupBaseEnvironment } from './base'
import workerInit from './init-threads'

workerInit({ runTests: runBaseTests, setup: setupBaseEnvironment })
