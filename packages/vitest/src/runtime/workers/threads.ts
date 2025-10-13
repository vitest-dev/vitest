import { runBaseTests } from './base'
import workerInit from './init-threads'

workerInit({ runTests: runBaseTests })
