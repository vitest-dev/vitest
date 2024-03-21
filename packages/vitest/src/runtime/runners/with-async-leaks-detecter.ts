import asyncHooks from 'node:async_hooks'
import { promisify } from 'node:util'
import { relative } from 'pathe'
import { rpc } from '../rpc'
import { VitestTestRunner } from './test'

export interface HangingOps {
  error: Error
  taskId?: string
}

const asyncSleep = promisify(setTimeout)

export class VitestTestRunnerWithAsyncLeaksDetecter extends VitestTestRunner {
  private hangingOps: Map<number, HangingOps> = new Map()

  private asyncHook: asyncHooks.AsyncHook = asyncHooks.createHook({
    init: (asyncId, type, triggerAsyncId) => {
      // Ignore some async resources
      if (
        [
          'PROMISE',
          'TIMERWRAP',
          'ELDHISTOGRAM',
          'PerformanceObserver',
          'RANDOMBYTESREQUEST',
          'DNSCHANNEL',
          'ZLIB',
          'SIGNREQUEST',
          'TLSWRAP',
          'TCPWRAP',
        ].includes(type)
      )
        return

      const task = this.workerState.current
      const filepath = task?.file?.filepath || this.workerState.filepath
      if (!filepath)
        return

      const { stackTraceLimit } = Error
      Error.stackTraceLimit = Math.max(100, stackTraceLimit)
      const error = new Error(type)

      let fromUser = error.stack?.includes(filepath)
      let directlyTriggered = true

      if (!fromUser) {
        // Check if the async resource is indirectly triggered by user code
        const trigger = this.hangingOps.get(triggerAsyncId)
        if (trigger) {
          fromUser = true
          directlyTriggered = false
          error.stack = trigger.error.stack
        }
      }

      if (fromUser) {
        const relativePath = relative(this.config.root, filepath)
        if (directlyTriggered) {
          error.stack = error.stack
            ?.split(/\n\s+/)
            .findLast(s => s.includes(filepath))
            ?.replace(filepath, relativePath)
        }

        this.hangingOps.set(asyncId, {
          error,
          taskId: task?.id || relativePath,
        })
      }
    },
    destroy: (asyncId) => {
      this.hangingOps.delete(asyncId)
    },
  })

  onBeforeRunFiles() {
    super.onBeforeRunFiles()
    this.asyncHook.enable()
  }

  async onAfterRunFiles() {
    // Wait for async resources to be destroyed
    await asyncSleep(0)
    if (this.hangingOps.size > 0)
      await asyncSleep(0)

    rpc().detectAsyncLeaks(Array.from(this.hangingOps.values()))
    this.asyncHook.disable()
    super.onAfterRunFiles()
  }
}
