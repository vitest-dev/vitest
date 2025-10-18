import workerInit from './init-threads'
import { runVmTests } from './vm'

workerInit({ runTests: runVmTests })
