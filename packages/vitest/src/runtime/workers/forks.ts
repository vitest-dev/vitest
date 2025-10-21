import { runBaseTests } from './base'
import workerInit from './init-forks'

workerInit({ runTests: runBaseTests })
