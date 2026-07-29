import { workerDep } from './worker-dep'

self.postMessage(workerDep())
