import type { Vitest } from 'vitest/node'
import type { Reporter, Task } from '../types'
import { parseStacktrace } from '../utils/source-map'

const IDENT = '    '

function yamlString(str: string): string {
  return `"${str.replace('"', '\\"')}"`
}

function tapString(str: string): string {
  // Test name cannot contain #
  // Test name cannot start with number
  return str.replace('#', '?').replace(/^[0-9]+/, '?')
}

export class TapReporter implements Reporter {
  private ctx!: Vitest

  onInit(ctx: Vitest): void {
    this.ctx = ctx
  }

  logTasks(tasks: Task[], currentIdent: string) {
    this.ctx.log(`${currentIdent}1..${tasks.length}`)

    for (const task of tasks) {
      const state = task.result?.state
      const ok = state != null && (state === 'pass' || state === 'skip') ? 'ok' : 'not ok'

      let comment = ''
      if (task.mode === 'skip')
        comment = ' # SKIP'
      else if (task.mode === 'todo')
        comment = ' # TODO'
      else if (task.result?.duration != null)
        comment = ` # time=${task.result.duration.toFixed(2)}ms`

      if (task.type === 'suite') {
        this.ctx.log(`${currentIdent}${ok} - ${tapString(task.name)}${comment} {`)

        this.logTasks(task.tasks, `${currentIdent}${IDENT}`)

        this.ctx.log(`${currentIdent}}`)
      }
      else {
        this.ctx.log(`${currentIdent}${ok} - ${tapString(task.name)}${comment}`)

        if (task.result?.state === 'fail' && task.result.error) {
          const error = task.result.error

          const baseErrorIdent = `${currentIdent}  `
          const errorIdent = `${currentIdent}    `
          this.ctx.log(`${baseErrorIdent}---`)
          this.ctx.log(`${baseErrorIdent}error:`)
          this.ctx.log(`${errorIdent}name: ${yamlString(error.name)}`)
          this.ctx.log(`${errorIdent}message: ${yamlString(error.message)}`)
          const stacks = parseStacktrace(error)
          const stack = stacks[0]
          if (stack)
            this.ctx.log(`${errorIdent}stack: ${yamlString(`${stack.file}:${stack.line}:${stack.column}`)}`)

          if (error.showDiff) {
            this.ctx.log(`${baseErrorIdent}found: ${yamlString(error.actual)}`)
            this.ctx.log(`${baseErrorIdent}wanted: ${yamlString(error.expected)}`)
          }

          this.ctx.log(`${baseErrorIdent}...`)
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
