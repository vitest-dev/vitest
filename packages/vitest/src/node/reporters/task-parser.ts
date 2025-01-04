// TODO: Remove once Reporter API implements these life cycles

import type { File, Task, TaskResultPack, Test } from '@vitest/runner'
import type { Vitest } from '../core'

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

  onTaskUpdate(packs: TaskResultPack[]) {
    const startingHooks: HookOptions[] = []
    const endingHooks: HookOptions[] = []

    for (const pack of packs) {
      const task = this.ctx.state.idMap.get(pack[0])

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
    startingHooks.forEach(hook => this.onHookStart(hook))
  }
}
