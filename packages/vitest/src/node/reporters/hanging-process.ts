import type { Reporter } from '../types/reporter'

export class HangingProcessReporter implements Reporter {
  whyRunning: (() => void) | undefined

  async onInit(): Promise<void> {
    this.whyRunning = await import('why-is-node-running').then(mod => mod.default)
  }

  onProcessTimeout(): void {
    this.whyRunning?.()
  }
}
