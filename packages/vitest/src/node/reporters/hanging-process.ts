import { createRequire } from 'node:module'
import type { Reporter } from '../../types'

export class HangingProcessReporter implements Reporter {
  whyRunning: (() => void) | undefined

  onInit(): void {
    const _require = createRequire(import.meta.url)
    this.whyRunning = _require('why-is-node-running')
  }

  onProcessTimeout() {
    this.whyRunning?.()
  }
}
