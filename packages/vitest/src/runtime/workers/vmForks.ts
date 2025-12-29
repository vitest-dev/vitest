import workerInit from './init-forks'
import { runVmTests, setupVmWorker } from './vm'

workerInit({ runTests: runVmTests, setup: setupVmWorker })
