import { Reporter } from '../types'

export class WorkerReporter implements Reporter {
  constructor(public port: MessagePort) {
  }

  onStart() {
    this.port.postMessage({ type: 'report', event: 'onStart' })
  }

  onCollected() {
    this.port.postMessage({ type: 'report', event: 'onCollected' })
  }

  onFinished() {
    this.port.postMessage({ type: 'report', event: 'onFinished' })
  }
}
