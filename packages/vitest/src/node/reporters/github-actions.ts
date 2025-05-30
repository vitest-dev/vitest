import type { File, TestAnnotation } from '@vitest/runner'
import type { Vitest } from '../core'
import type { TestProject } from '../project'
import type { Reporter } from '../types/reporter'
import type { TestCase } from './reported-tasks'
import { stripVTControlCharacters } from 'node:util'
import { getFullName, getTasks } from '@vitest/runner/utils'
import { capturePrintError } from '../printError'

export interface GithubActionsReporterOptions {
  onWritePath?: (path: string) => string
}

export class GithubActionsReporter implements Reporter {
  ctx: Vitest = undefined!
  options: GithubActionsReporterOptions

  constructor(options: GithubActionsReporterOptions = {}) {
    this.options = options
  }

  onInit(ctx: Vitest): void {
    this.ctx = ctx
  }

  onTestCaseAnnotate(testCase: TestCase, annotation: TestAnnotation): void {
    if (!annotation.location) {
      return
    }

    const type = getTitle(annotation.type)
    const formatted = formatMessage({
      command: getType(annotation.type),
      properties: {
        file: annotation.location.file,
        line: String(annotation.location.line),
        column: String(annotation.location.column),
        ...(type && { title: type }),
      },
      message: stripVTControlCharacters(annotation.message),
    })
    this.ctx.logger.log(`\n${formatted}`)
  }

  onFinished(files: File[] = [], errors: unknown[] = []): void {
    // collect all errors and associate them with projects
    const projectErrors = new Array<{
      project: TestProject
      title: string
      error: unknown
      file?: File
    }>()
    for (const error of errors) {
      projectErrors.push({
        project: this.ctx.getRootProject(),
        title: 'Unhandled error',
        error,
      })
    }
    for (const file of files) {
      const tasks = getTasks(file)
      const project = this.ctx.getProjectByName(file.projectName || '')
      for (const task of tasks) {
        if (task.result?.state !== 'fail') {
          continue
        }

        const title = getFullName(task, ' > ')
        for (const error of task.result?.errors ?? []) {
          projectErrors.push({
            project,
            title,
            error,
            file,
          })
        }
      }
    }

    const onWritePath = this.options.onWritePath ?? defaultOnWritePath

    // format errors via `printError`
    for (const { project, title, error, file } of projectErrors) {
      const result = capturePrintError(error, this.ctx, { project, task: file })
      const stack = result?.nearest
      if (!stack) {
        continue
      }
      const formatted = formatMessage({
        command: 'error',
        properties: {
          file: onWritePath(stack.file),
          title,
          line: String(stack.line),
          column: String(stack.column),
        },
        message: stripVTControlCharacters(result.output),
      })
      this.ctx.logger.log(`\n${formatted}`)
    }
  }
}

const BUILT_IN_TYPES = ['notice', 'error', 'warning']

function getTitle(type: string) {
  if (BUILT_IN_TYPES.includes(type)) {
    return undefined
  }
  return type
}

function getType(type: string) {
  if (BUILT_IN_TYPES.includes(type)) {
    return type
  }
  return 'notice'
}

function defaultOnWritePath(path: string): string {
  return path
}

// workflow command formatting based on
// https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#setting-an-error-message
// https://github.com/actions/toolkit/blob/f1d9b4b985e6f0f728b4b766db73498403fd5ca3/packages/core/src/command.ts#L80-L85
function formatMessage({
  command,
  properties,
  message,
}: {
  command: string
  properties: Record<string, string>
  message: string
}): string {
  let result = `::${command}`
  Object.entries(properties).forEach(([k, v], i) => {
    result += i === 0 ? ' ' : ','
    result += `${k}=${escapeProperty(v)}`
  })
  result += `::${escapeData(message)}`
  return result
}

function escapeData(s: string): string {
  return s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
}

function escapeProperty(s: string): string {
  return s
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A')
    .replace(/:/g, '%3A')
    .replace(/,/g, '%2C')
}
