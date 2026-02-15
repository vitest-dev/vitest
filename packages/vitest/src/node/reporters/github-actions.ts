import type { File, TestAnnotation } from '@vitest/runner'
import type { SerializedError } from '@vitest/utils'
import type { Vitest } from '../core'
import type { TestProject } from '../project'
import type { Reporter } from '../types/reporter'
import type { TestCase, TestModule } from './reported-tasks'
import { writeFileSync } from 'node:fs'
import { relative } from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { getFullName, getTasks } from '@vitest/runner/utils'
import { capturePrintError } from '../printError'

export interface GithubActionsReporterOptions {
  onWritePath?: (path: string) => string
  /**
   * @default true
   */
  displayAnnotations?: boolean
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
    if (!annotation.location || this.options.displayAnnotations === false) {
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

  onTestRunEnd(
    testModules: ReadonlyArray<TestModule>,
    unhandledErrors: ReadonlyArray<SerializedError>,
  ): void {
    const files = testModules.map(testModule => testModule.task)
    const errors = [...unhandledErrors]

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
            title: project.name ? `[${project.name}] ${title}` : title,
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

    if (process.env.GITHUB_STEP_SUMMARY) {
      try {
        writeFileSync(
          process.env.GITHUB_STEP_SUMMARY,
          GithubActionsReporter.#createSummary(testModules),
          { flag: 'a' },
        )
      }
      catch {
        this.ctx.logger.warn('Could not write summary to $GITHUB_STEP_SUMMARY')
      }
    }
  }

  static #createSummary(testModules: ReadonlyArray<TestModule>): string {
    let output = '## Vitest Summary\n'

    let flakyTests = '\n### Flaky Tests\n\nThese tests passed only after one or more retries, indicating potential instability.\n'
    const flakyTestsHeaderLength = flakyTests.length

    for (const module of testModules) {
      let flakyTestsCounter = 0
      let flakyTestsContent = ''

      for (const test of module.children.allTests()) {
        const diagnostic = test.diagnostic()

        if (diagnostic?.flaky) {
          flakyTestsCounter += 1

          const retries = typeof test.options.retry === 'number'
            ? test.options.retry
            : (test.options.retry?.count
              // falling back to `retryCount` as we compute the retry ratio which should be <= 1
              ?? diagnostic.retryCount)
          const retriesRatio = diagnostic.retryCount / retries

          const repository = process.env.GITHUB_REPOSITORY
          const commitHash = process.env.GITHUB_SHA
          const rootPath = process.env.GITHUB_WORKSPACE
          const testLocationLine = test.task.location?.line ? `#L${test.task.location.line}` : ''

          const testLink
            = repository && commitHash && rootPath
              ? `https://github.com/${repository}/blob/${commitHash}/${relative(rootPath, module.moduleId)}${testLocationLine}`
              : null
          const testName = testLink === null ? `\`${test.task.fullTestName}\`` : `[\`${test.task.fullTestName}\`](${testLink})`
          const retriesText = `passed on retry ${diagnostic.retryCount} out of ${retries}`

          flakyTestsContent += `\n- ${testName} (${retriesRatio > 0.7 ? `**${retriesText}**` : retriesText})`
        }
      }

      if (flakyTestsCounter > 0) {
        flakyTests += `\n##### \`${module.relativeModuleId}\` (${flakyTestsCounter} flaky tests)\n${flakyTestsContent}\n`
      }
    }

    if (flakyTests.length > flakyTestsHeaderLength) {
      output += flakyTests
    }

    return output
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
