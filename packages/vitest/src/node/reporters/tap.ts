import type { Task } from '@vitest/runner'
import type { ErrorWithDiff, ParsedStack } from '@vitest/utils'
import type { Vitest } from '../core'
import type { Reporter } from '../types/reporter'
import { parseErrorStacktrace } from '../../utils/source-map'
import { IndentedLogger } from './renderers/indented-logger'

function yamlString(str: string): string {
  return `"${str.replace(/"/g, '\\"')}"`
}

function tapString(str: string): string {
  return str
    .replace(/\\/g, '\\\\') // escape slashes
    .replace(/#/g, '\\#') // escape #
    .replace(/\n/g, ' ') // remove newlines
}

export class TapReporter implements Reporter {
  protected ctx!: Vitest
  private logger!: IndentedLogger

  onInit(ctx: Vitest): void {
    this.ctx = ctx
    this.logger = new IndentedLogger(ctx.logger.log.bind(ctx.logger))
  }

  static getComment(task: Task): string {
    if (task.mode === 'skip') {
      return ' # SKIP'
    }
    else if (task.mode === 'todo') {
      return ' # TODO'
    }
    else if (task.result?.duration != null) {
      return ` # time=${task.result.duration.toFixed(2)}ms`
    }
    else {
      return ''
    }
  }

  private logErrorDetails(error: ErrorWithDiff, stack?: ParsedStack) {
    const errorName = error.name || error.nameStr || 'Unknown Error'
    this.logger.log(`name: ${yamlString(String(errorName))}`)
    this.logger.log(`message: ${yamlString(String(error.message))}`)

    if (stack) {
      // For compatibility with tap-mocha-reporter
      this.logger.log(
        `stack: ${yamlString(`${stack.file}:${stack.line}:${stack.column}`)}`,
      )
    }
  }

  protected logTasks(tasks: Task[]) {
    this.logger.log(`1..${tasks.length}`)

    for (const [i, task] of tasks.entries()) {
      const id = i + 1

      const ok
        = task.result?.state === 'pass'
          || task.mode === 'skip'
          || task.mode === 'todo'
          ? 'ok'
          : 'not ok'

      const comment = TapReporter.getComment(task)

      if (task.type === 'suite' && task.tasks.length > 0) {
        this.logger.log(`${ok} ${id} - ${tapString(task.name)}${comment} {`)

        this.logger.indent()
        this.logTasks(task.tasks)
        this.logger.unindent()

        this.logger.log('}')
      }
      else {
        this.logger.log(`${ok} ${id} - ${tapString(task.name)}${comment}`)

        const project = this.ctx.getProjectByName(task.file.projectName || '')

        if (task.result?.state === 'fail' && task.result.errors) {
          this.logger.indent()

          task.result.errors.forEach((error) => {
            const stacks = task.file.pool === 'browser'
              ? (project.browser?.parseErrorStacktrace(error) || [])
              : parseErrorStacktrace(error, {
                  frameFilter: this.ctx.config.onStackTrace,
                })
            const stack = stacks[0]

            this.logger.log('---')
            this.logger.log('error:')

            this.logger.indent()
            this.logErrorDetails(error)
            this.logger.unindent()

            if (stack) {
              this.logger.log(
                `at: ${yamlString(
                  `${stack.file}:${stack.line}:${stack.column}`,
                )}`,
              )
            }

            if (error.showDiff) {
              this.logger.log(`actual: ${yamlString(error.actual)}`)
              this.logger.log(`expected: ${yamlString(error.expected)}`)
            }
          })

          this.logger.log('...')
          this.logger.unindent()
        }
      }
    }
  }

  onFinished(files = this.ctx.state.getFiles()) {
    this.logger.log('TAP version 13')

    this.logTasks(files)
  }
}
