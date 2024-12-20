import type { File, Task, TaskResultPack, Test } from '@vitest/runner'
import type { Vitest } from '../core'
import { getTests } from '@vitest/runner/utils'

export interface HookOptions {
  name: string
  file: File
  id: File['id'] | Test['id']
  type: Task['type']
}

export class TaskParser {
  ctx!: Vitest

  onInit(ctx: Vitest) {
    this.ctx = ctx
  }

  onHookStart(_options: HookOptions) {}
  onHookEnd(_options: HookOptions) {}

  onTestStart(_test: Test) {}
  onTestFinished(_test: Test) {}

  onTestFilePrepare(_file: File) {}
  onTestFileFinished(_file: File) {}

  onTaskUpdate(packs: TaskResultPack[]) {
    const startingTestFiles: File[] = []
    const finishedTestFiles: File[] = []

    const startingTests: Test[] = []
    const finishedTests: Test[] = []

    const startingHooks: HookOptions[] = []
    const endingHooks: HookOptions[] = []

    for (const pack of packs) {
      const task = this.ctx.state.idMap.get(pack[0])

      if (task?.type === 'suite' && 'filepath' in task && task.result?.state) {
        if (task?.result?.state === 'run' || task?.result?.state === 'queued') {
          startingTestFiles.push(task)
        }
        else {
          // Skipped tests are not reported, do it manually
          for (const test of getTests(task)) {
            if (!test.result || test.result?.state === 'skip') {
              finishedTests.push(test)
            }
          }

          finishedTestFiles.push(task.file)
        }
      }

      if (task?.type === 'test') {
        if (task.result?.state === 'run' || task.result?.state === 'queued') {
          startingTests.push(task)
        }
        else if (task.result?.hooks?.afterEach !== 'run') {
          finishedTests.push(task)
        }
      }

      if (task?.result?.hooks) {
        for (const [hook, state] of Object.entries(task.result.hooks)) {
          if (state === 'run' || state === 'queued') {
            startingHooks.push({ name: hook, file: task.file, id: task.id, type: task.type })
          }
          else {
            endingHooks.push({ name: hook, file: task.file, id: task.id, type: task.type })
          }
        }
      }
    }

    endingHooks.forEach(hook => this.onHookEnd(hook))
    finishedTests.forEach(test => this.onTestFinished(test))
    finishedTestFiles.forEach(file => this.onTestFileFinished(file))

    startingTestFiles.forEach(file => this.onTestFilePrepare(file))
    startingTests.forEach(test => this.onTestStart(test))
    startingHooks.forEach(hook => this.onHookStart(hook))
  }
}
