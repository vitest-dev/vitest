import type { File, TestAnnotation } from '@vitest/runner'
import type { SerializedError } from '@vitest/utils'
import type { Vitest } from '../core'
import type { TestProject } from '../project'
import type { Reporter } from '../types/reporter'
import type { TestCase, TestModule } from './reported-tasks'
import { writeFileSync } from 'node:fs'
import { stripVTControlCharacters } from 'node:util'
import { getFullName, getTasks } from '@vitest/runner/utils'
import { deepMerge } from '@vitest/utils/helpers'
import { relative } from 'pathe'
import { capturePrintError } from '../printError'
import { noun } from './renderers/utils'

export interface GithubActionsReporterOptions {
  onWritePath?: (path: string) => string
  /**
   * @default true
   */
  displayAnnotations?: boolean
  /**
   * Configuration for the GitHub Actions Job Summary.
   *
   * When enabled, a markdown summary of test results is written to the path specified by `outputPath`.
   */
  jobSummary?: {
    /**
     * Whether to generate the summary.
     *
     * @default true
     */
    enabled?: boolean
    /**
     * File path to write the summary to.
     *
     * @default process.env.GITHUB_STEP_SUMMARY
     */
    outputPath?: string | undefined
    /**
     * Configuration for generating permalink URLs to source files in the GitHub repository.
     *
     * When all three values are available (either from this config or the defaults picked from environment variables), test names in the summary will link to the relevant source lines.
     */
    fileLinks?: {
      /**
       * The GitHub repository in `owner/repo` format.
       *
       * @default process.env.GITHUB_REPOSITORY
       */
      repository?: string | undefined
      /**
       * The commit SHA to use in permalink URLs.
       *
       * @default process.env.GITHUB_SHA
       */
      commitHash?: string | undefined
      /**
       * The absolute path to the root of the repository on disk.
       *
       * This value is used to compute relative file paths for the permalink URLs.
       *
       * @default process.env.GITHUB_WORKSPACE
       */
      workspacePath?: string | undefined
    }
  }
}

type SummaryOptions = NonNullable<GithubActionsReporterOptions['jobSummary']>

interface ResolvedOptions extends Required<GithubActionsReporterOptions> {
  // only `enabled` is required as the other values can be `undefined` as they're env variables
  jobSummary: Required<Pick<SummaryOptions, 'enabled'>> & Omit<SummaryOptions, 'enabled'>
}

const defaultOptions: ResolvedOptions = {
  onWritePath: defaultOnWritePath,
  displayAnnotations: true,
  jobSummary: {
    enabled: true,
    outputPath: process.env.GITHUB_STEP_SUMMARY,
    fileLinks: {
      repository: process.env.GITHUB_REPOSITORY,
      commitHash: process.env.GITHUB_SHA,
      workspacePath: process.env.GITHUB_WORKSPACE,
    },
  },
}

export class GithubActionsReporter implements Reporter {
  ctx: Vitest = undefined!
  options: ResolvedOptions

  constructor(options: GithubActionsReporterOptions = {}) {
    this.options = deepMerge(Object.create(null), defaultOptions, options)
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
          file: this.options.onWritePath(stack.file),
          title,
          line: String(stack.line),
          column: String(stack.column),
        },
        message: stripVTControlCharacters(result.output),
      })
      this.ctx.logger.log(`\n${formatted}`)
    }

    if (this.options.jobSummary.enabled === true && this.options.jobSummary.outputPath) {
      const summary = renderSummary(collectSummaryData(testModules), this.options.jobSummary.fileLinks)

      if (summary !== null) {
        try {
          writeFileSync(
            this.options.jobSummary.outputPath,
            summary,
            { flag: 'a' },
          )
        }
        catch (error) {
          this.ctx.logger.warn('Could not write summary to `options.summary.outputPath`', error)
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
  stats: Record<'failed' | 'passed' | 'expectedFail' | 'skipped' | 'todo', number>
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
  const summaryData: SummaryData = {
    stats: {
      failed: 0,
      passed: 0,
      expectedFail: 0,
      skipped: 0,
      todo: 0,
    },
    flakyTests: [],
  }

  for (const module of testModules) {
    const flakyTests: SummaryData['flakyTests'][number] = {
      path: { relative: module.relativeModuleId, absolute: module.moduleId },
      tests: [],
    }

    for (const test of module.children.allTests()) {
      switch (test.task.mode) {
        case 'skip': {
          summaryData.stats.skipped += 1
          break
        }
        case 'todo': {
          summaryData.stats.todo += 1
          break
        }
        default: {
          switch (test.task.result?.state) {
            case 'fail': {
              summaryData.stats.failed += 1
              break
            }
            case 'pass': {
              if (test.task.fails) {
                summaryData.stats.expectedFail += 1
              }
              else {
                summaryData.stats.passed += 1
              }

              break
            }
          }
        }
      }

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

function createGitHubFileLinkCreator(fileLinks: SummaryOptions['fileLinks']): (path: string, line?: number) => string | null {
  const repository = fileLinks?.repository
  const commitHash = fileLinks?.commitHash
  const workspacePath = fileLinks?.workspacePath

  if (repository !== undefined && commitHash !== undefined && workspacePath !== undefined) {
    return (path, line) => {
      const lineFragment = line !== undefined ? `#L${line}` : ''

      return `https://github.com/${repository}/blob/${commitHash}/${relative(workspacePath, path)}${lineFragment}`
    }
  }

  return () => null
}

function mdLink(text: string, url: string | null): string {
  return url === null ? text : `[${text}](${url})`
}

function renderStats(stats: SummaryData['stats']): string {
  const total = stats.failed + stats.skipped + stats.passed

  let output = '\n### Summary\n\n'

  if (stats.failed > 0) {
    output += `❌ **${stats.failed} ${noun(stats.failed, 'failure', 'failures')}** · `
  }

  if (stats.skipped > 0) {
    output += `⚠️ **${stats.skipped} ${noun(stats.skipped, 'skip', 'skips')}** · `
  }

  output += `✅ **${stats.passed} ${noun(stats.passed, 'pass', 'passes')}** · ${total} total\n`

  const secondaryInfo: string[] = []

  if (stats.expectedFail > 0) {
    secondaryInfo.push(`${stats.expectedFail} expected ${noun(stats.expectedFail, 'failure', 'failures')}`)
  }

  if (stats.todo > 0) {
    secondaryInfo.push(`${stats.todo} ${noun(stats.todo, 'todo', 'todos')}`)
  }

  if (secondaryInfo.length > 0) {
    output += `${secondaryInfo.join(' · ')} · ${stats.expectedFail + stats.todo} total\n`
  }

  return output
}

const SUMMARY_HEADER = '## Vitest Test Report\n'

function renderSummary(summaryData: SummaryData, fileLinks: SummaryOptions['fileLinks']): string | null {
  const fileLinkCreator = createGitHubFileLinkCreator(fileLinks)

  let summary = `${SUMMARY_HEADER}${renderStats(summaryData.stats)}`

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

  if (!summary.endsWith('\n')) {
    summary += '\n'
  }

  return summary
}
