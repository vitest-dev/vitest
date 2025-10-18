import workerInit from './init-forks'
import { runVmTests } from './vm'

workerInit({ runTests: runVmTests })
