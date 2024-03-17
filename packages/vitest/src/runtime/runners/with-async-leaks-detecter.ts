import asyncHooks from 'node:async_hooks'
import { relative } from 'pathe'
import { rpc } from '../rpc'
import { VitestTestRunner } from './test'

export interface HangingOps {
  type: string
  stack: string
  taskId?: string
}

export class VitestTestRunnerWithAsyncLeaksDetecter extends VitestTestRunner {
  private hangingOps: Map<number, HangingOps> = new Map()

  private asyncHook: asyncHooks.AsyncHook = asyncHooks.createHook({
    init: (id, type) => {
      const task = this.workerState.current
      const filepath = task?.file?.filepath || this.workerState.filepath

      let stack = new Error('STACK_TRACE_ERROR').stack

      if (filepath && stack?.includes(filepath)) {
        stack = stack.split(/\n\s+/).findLast(s => s.includes(filepath))

        if (stack) {
          const hangingOp = {
            type,
            stack,
            taskId: task?.id || relative(this.config.root, filepath),
          }

          this.hangingOps.set(id, hangingOp)
        }
      }
    },
    destroy: id => this.hangingOps.delete(id),
  })

  onBeforeRunFiles() {
    super.onBeforeRunFiles()
    this.asyncHook.enable()
  }

  onAfterRunFiles() {
    rpc().detectAsyncLeaks(Array.from(this.hangingOps.values()))
    this.asyncHook.disable()
    super.onAfterRunFiles()
  }
}
