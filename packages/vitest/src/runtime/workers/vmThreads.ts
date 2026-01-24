import workerInit from './init-threads'
import { runVmTests, setupVmWorker } from './vm'

workerInit({ runTests: runVmTests, setup: setupVmWorker })
