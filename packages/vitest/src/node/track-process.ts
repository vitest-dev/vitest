import { createRequire } from 'module'

const _require = createRequire(import.meta.url)

let whyRunning: (() => void) | undefined

export function startTrackingProcesses() {
  whyRunning = _require('why-is-node-running')
}

export function logRunningProcesses() {
  if (whyRunning)
    whyRunning()
}
