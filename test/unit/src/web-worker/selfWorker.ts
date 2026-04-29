import subSelf from './selfWorkerDep'

self.postMessage(subSelf === self)
