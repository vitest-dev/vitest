import { runBaseTests, setupBaseEnvironment } from './base'
import workerInit from './init-forks'

workerInit({ runTests: runBaseTests, setup: setupBaseEnvironment })
