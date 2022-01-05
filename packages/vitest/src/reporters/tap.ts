import type { Vitest } from 'vitest/node'
import type { Reporter, Task } from '../types'
import { parseStacktrace } from '../utils/source-map'

const IDENT = '    '

export class TapReporter implements Reporter {
  private ctx!: Vitest

  onInit(ctx: Vitest): void {
    this.ctx = ctx
  }

  logTasks(tasks: Task[], currentIdent: string) {
    this.ctx.log(`${currentIdent}1..${tasks.length}`)

    for (const task of tasks) {
      const state = task.result?.state
      const skip = task.mode === 'skip' || task.mode === 'todo'
      const ok = skip || (state != null && (state === 'pass' || state === 'skip')) ? 'ok' : 'not ok'

      if (task.type === 'suite') {
        this.ctx.log(`${currentIdent}${ok} - ${task.name} {`)

        this.logTasks(task.tasks, `${currentIdent}${IDENT}`)

        this.ctx.log(`${currentIdent}}`)
      }
      else {
        let comment = ''
        if (task.mode === 'skip')
          comment = ' # SKIP'
        else if (task.mode === 'todo')
          comment = ' # TODO'
        else if (task.result?.duration != null)
          comment = ` # time=${task.result.duration.toFixed(2)}ms`

        this.ctx.log(`${currentIdent}${ok} - ${task.name}${comment}`)

        if (task.result?.state === 'fail' && task.result.error) {
          const error = task.result.error

          const errorIdent = `${currentIdent}  `
          this.ctx.log(`${errorIdent}---`)
          this.ctx.log(`${errorIdent}message: ${error.message}`)
          const stacks = parseStacktrace(error)
          const stack = stacks[0]
          if (stack)
            this.ctx.log(`${errorIdent}stack: ${stack.file}:${stack.line}:${stack.column}`)

          if (error.showDiff) {
            this.ctx.log(`${errorIdent}actual: ${error.actual}`)
            this.ctx.log(`${errorIdent}expected: ${error.expected}`)
          }

          this.ctx.log(`${errorIdent}...`)
        }
      }
    }
  }

  async onFinished(files = this.ctx.state.getFiles()) {
    this.ctx.log('TAP version 13')

    // TODO: Flatten tasks for better compatibility (maybe based on the reporter parameter)
    this.logTasks(files, '')
  }
}
