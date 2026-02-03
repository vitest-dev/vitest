import type { File, TestAnnotation } from '@vitest/runner'
import type { SerializedError } from '@vitest/utils'
import type { Vitest } from '../core'
import type { TestProject } from '../project'
import type { Reporter } from '../types/reporter'
import type { TestCase, TestModule } from './reported-tasks'
import { writeFileSync } from 'node:fs'
import { stripVTControlCharacters } from 'node:util'
import { getFullName, getTasks } from '@vitest/runner/utils'
import { relative } from 'pathe'
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
      const summary = renderSummary(collectSummaryData(testModules))

      if (summary !== null) {
        try {
          writeFileSync(
            process.env.GITHUB_STEP_SUMMARY,
            summary,
            { flag: 'a' },
          )
        }
        catch (error) {
          this.ctx.logger.warn('Could not write summary to $GITHUB_STEP_SUMMARY', error)
        }
      }
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

interface SummaryData {
  flakyTests: Array<{
    path: {
      relative: string
      absolute: string
    }
    tests: Array<{
      testName: string
      line: number | undefined
      retries: {
        allowed: number
        count: number
        ratio: number
      }
    }>
  }>
}

function collectSummaryData(testModules: ReadonlyArray<TestModule>): SummaryData {
  const summaryData: SummaryData = { flakyTests: [] }

  for (const module of testModules) {
    const flakyTests: SummaryData['flakyTests'][number] = {
      path: { relative: module.relativeModuleId, absolute: module.moduleId },
      tests: [],
    }

    for (const test of module.children.allTests()) {
      const diagnostic = test.diagnostic()

      if (diagnostic?.flaky) {
        const retriesAllowed = typeof test.options.retry === 'number'
          ? test.options.retry
          : (test.options.retry?.count
            // falling back to `retryCount` as this is used as the denominator to compute `retryRatio`
            ?? diagnostic.retryCount)
        const retriesRatio = diagnostic.retryCount / retriesAllowed

        flakyTests.tests.push({
          retries: {
            allowed: retriesAllowed,
            count: diagnostic.retryCount,
            ratio: retriesRatio,
          },
          line: test.task.location?.line,
          testName: test.task.fullTestName,
        })
      }
    }

    if (flakyTests.tests.length > 0) {
      flakyTests.tests.sort((a, b) => b.retries.ratio - a.retries.ratio)

      summaryData.flakyTests.push(flakyTests)
    }
  }

  return summaryData
}

function createGitHubFileLinkCreator(): (path: string, line?: number) => string | null {
  const repository = process.env.GITHUB_REPOSITORY
  const commitHash = process.env.GITHUB_SHA
  const rootPath = process.env.GITHUB_WORKSPACE

  if (repository !== undefined && commitHash !== undefined && rootPath !== undefined) {
    return (path, line) => {
      const lineFragment = line !== undefined ? `#L${line}` : ''

      return `https://github.com/${repository}/blob/${commitHash}/${relative(rootPath, path)}${lineFragment}`
    }
  }

  return () => null
}

function mdLink(text: string, url: string | null): string {
  return url === null ? text : `[${text}](${url})`
}

const SUMMARY_HEADER = '## Vitest Test Report\n'

function renderSummary(summaryData: SummaryData): string | null {
  const fileLinkCreator = createGitHubFileLinkCreator()

  let summary = SUMMARY_HEADER

  if (summaryData.flakyTests.length > 0) {
    summary += '\n### Flaky Tests\n\nThese tests passed only after one or more retries, indicating potential instability.\n'

    for (const flakyTests of summaryData.flakyTests) {
      summary += `\n##### \`${flakyTests.path.relative}\` (${flakyTests.tests.length} flaky tests)\n`

      for (const flakyTest of flakyTests.tests) {
        const retriesText = `passed on retry ${flakyTest.retries.count} out of ${flakyTest.retries.allowed}`

        summary += `\n- ${mdLink(`\`${flakyTest.testName}\``, fileLinkCreator(flakyTests.path.absolute, flakyTest.line))} (${flakyTest.retries.ratio >= 0.8 ? `**${retriesText}**` : retriesText})`
      }

      summary += '\n'
    }
  }

  if (summary === SUMMARY_HEADER) {
    return null
  }

  if (!summary.endsWith('\n')) {
    summary += '\n'
  }

  return summary
}
