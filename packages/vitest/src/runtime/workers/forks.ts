import { runBaseTests, setupEnvironment } from './base'
import workerInit from './init-forks'

workerInit({ runTests: runBaseTests, setup: setupEnvironment })
