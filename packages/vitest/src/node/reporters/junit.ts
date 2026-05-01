import type { Task } from '@vitest/runner'
import type { SerializedError } from '@vitest/utils'
import type { Vitest } from '../core'
import type { ErrorOptions } from '../logger'
import type { Reporter } from '../types/reporter'
import type { TestModule } from './reported-tasks'
import { existsSync, promises as fs } from 'node:fs'

import { hostname } from 'node:os'
import { stripVTControlCharacters } from 'node:util'
import { getSuites } from '@vitest/runner/utils'
import { basename, dirname, relative, resolve } from 'pathe'
import { getOutputFile } from '../../utils/config-helpers'
import { capturePrintError } from '../printError'
import { IndentedLogger } from './renderers/indented-logger'

export interface ClassnameTemplateVariables {
  /** Relative path from the root (e.g. `src/foo.test.ts`) */
  filename: string
  /** Absolute file path */
  filepath: string
  /** File basename without directory (e.g. `foo.test.ts`) */
  basename: string
  /** Ancestor describe block names joined by {@link JUnitOptions.ancestorSeparator} */
  classname: string
  /** Leaf test title (the string passed to `it`/`test`) */
  title: string
  /** Top-level describe block name, or empty string when the test has no enclosing describe */
  suitename: string
  /** Vitest project name */
  displayName: string
}

export interface SuiteNameTemplateVariables {
  /** Absolute file path */
  filepath: string
  /** Relative path from the root (e.g. `src/foo.test.ts`) */
  filename: string
  /** File basename without directory (e.g. `foo.test.ts`) */
  basename: string
  /** Vitest project name */
  displayName: string
  /**
   * The name of the first top-level `describe` block in the file.
   * Falls back to the file basename when the file has no top-level describe.
   */
  title: string
}

export interface JUnitOptions {
  outputFile?: string

  /**
   * Template for the `classname` attribute of `<testcase>`.
   *
   * Can be a template string or a function.
   *
   * Supported placeholders:
   * - `{filename}` – relative path from root (e.g. `src/foo.test.ts`)
   * - `{filepath}` – absolute file path
   * - `{basename}` – file name without directory (e.g. `foo.test.ts`)
   * - `{classname}` – ancestor describe names joined by {@link ancestorSeparator}
   * - `{title}` – leaf test title
   * - `{suitename}` – top-level describe block name
   * - `{displayName}` – Vitest project name
   *
   * @default relative file path from root
   */
  classnameTemplate?: string | ((classnameVariables: ClassnameTemplateVariables) => string)

  /**
   * Template for the `name` attribute of `<testcase>`.
   *
   * Can be a template string or a function. Supports the same placeholders as
   * {@link classnameTemplate}.
   *
   * When not set the full test title including ancestor describe hierarchy is used
   * (current default behaviour, e.g. `outer > inner > test name`).
   */
  titleTemplate?: string | ((titleVariables: ClassnameTemplateVariables) => string)

  /**
   * Template for the `name` attribute of `<testsuite>`.
   *
   * Can be a template string or a function.
   *
   * Supported placeholders:
   * - `{title}` – first top-level describe name (falls back to file basename)
   * - `{filename}` – relative path from root
   * - `{filepath}` – absolute file path
   * - `{basename}` – file basename
   * - `{displayName}` – Vitest project name
   *
   * When not set the relative file path from root is used (current default behaviour).
   */
  suiteNameTemplate?: string | ((suiteNameVariables: SuiteNameTemplateVariables) => string)

  /**
   * Separator used to join ancestor describe block names when building the
   * `{classname}` template variable (and the default testcase name when
   * {@link titleTemplate} is not set).
   *
   * @default ' > '
   */
  ancestorSeparator?: string

  suiteName?: string
  /**
   * Write <system-out> and <system-err> for console output
   * @default true
   */
  includeConsoleOutput?: boolean
  /**
   * Add <testcase file="..."> attribute (validated on CIRCLE CI and GitLab CI)
   * @default false
   */
  addFileAttribute?: boolean
  /**
   * Hostname to use in the report. By default, it uses os.hostname()
   */
  hostname?: string
  /**
   * Include stack traces in test failure reports.
   * @default true
   */
  stackTrace?: boolean
}

/**
 * Internal task type that carries pre-computed template metadata.
 * The three underscore-prefixed fields are set by {@link flattenTasks} and
 * consumed only within the reporter. They are deliberately not part of the
 * public `Task` interface.
 */
type TaskWithMeta = Task & {
  /** Original leaf test title before hierarchy prefix was prepended */
  _leafName?: string
  /** Ancestor describe names joined by the active separator */
  _classname?: string
  /** Top-level describe block name */
  _suitename?: string
}

/**
 * Runtime additions on top of {@link SerializedError}: `type` is set by
 * {@link state.catchError}, `VITEST_TEST_PATH` by the runtime error catcher.
 */
type UnhandledError = SerializedError & {
  type?: string
  VITEST_TEST_PATH?: string
}

function flattenTasks(task: Task, baseName = '', suiteName = '', ancestorSeparator = ' > '): TaskWithMeta[] {
  if (task.type === 'suite') {
    const newBase = baseName ? `${baseName}${ancestorSeparator}${task.name}` : task.name
    const newSuiteName = suiteName || task.name
    return task.tasks.flatMap(child =>
      flattenTasks(child, newBase, newSuiteName, ancestorSeparator),
    )
  }
  else {
    const fullName = baseName ? `${baseName}${ancestorSeparator}${task.name}` : task.name
    const result: TaskWithMeta = {
      ...task,
      name: fullName,
      _leafName: task.name,
      _classname: baseName,
      _suitename: suiteName,
    }
    return [result]
  }
}

// https://gist.github.com/john-doherty/b9195065884cdbfd2017a4756e6409cc
function removeInvalidXMLCharacters(
  value: any,
  removeDiscouragedChars: boolean,
): string {
  let regex
    // eslint-disable-next-line no-control-regex
    = /([\0-\x08\v\f\x0E-\x1F\uFFFD\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])/g
  value = String(value || '').replace(regex, '')

  if (removeDiscouragedChars) {
    // remove everything discouraged by XML 1.0 specifications
    regex = new RegExp(
      /* eslint-disable regexp/prefer-character-class, regexp/no-obscure-range, regexp/no-useless-non-capturing-group */
      '([\\x7F-\\x84]|[\\x86-\\x9F]|[\\uFDD0-\\uFDEF]|\\uD83F[\\uDFFE\\uDFFF]|(?:\\uD87F[\\uDF'
      + 'FE\\uDFFF])|\\uD8BF[\\uDFFE\\uDFFF]|\\uD8FF[\\uDFFE\\uDFFF]|(?:\\uD93F[\\uDFFE\\uD'
      + 'FFF])|\\uD97F[\\uDFFE\\uDFFF]|\\uD9BF[\\uDFFE\\uDFFF]|\\uD9FF[\\uDFFE\\uDFFF]'
      + '|\\uDA3F[\\uDFFE\\uDFFF]|\\uDA7F[\\uDFFE\\uDFFF]|\\uDABF[\\uDFFE\\uDFFF]|(?:\\'
      + 'uDAFF[\\uDFFE\\uDFFF])|\\uDB3F[\\uDFFE\\uDFFF]|\\uDB7F[\\uDFFE\\uDFFF]|(?:\\uDBBF'
      + '[\\uDFFE\\uDFFF])|\\uDBFF[\\uDFFE\\uDFFF](?:[\\0-\\t\\v\\f\\x0E-\\u2027\\u202A-\\uD7FF\\'
      + 'uE000-\\uFFFF]|[\\uD800-\\uDBFF][\\uDC00-\\uDFFF]|[\\uD800-\\uDBFF](?![\\uDC00-\\uDFFF])|'
      // eslint-disable-next-line regexp/no-useless-assertions
      + '(?:[^\\uD800-\\uDBFF]|^)[\\uDC00-\\uDFFF]))',
      'g',
      /* eslint-enable */
    )

    value = value.replace(regex, '')
  }

  return value
}

function escapeXML(value: any): string {
  return removeInvalidXMLCharacters(
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;'),
    true,
  )
}

function executionTime(durationMS: number) {
  return (durationMS / 1000).toLocaleString('en-US', {
    useGrouping: false,
    maximumFractionDigits: 10,
  })
}

export function getDuration(task: Task): string | undefined {
  const duration = task.result?.duration ?? 0
  return executionTime(duration)
}

export class JUnitReporter implements Reporter {
  private ctx!: Vitest
  private reportFile?: string
  private baseLog!: (text: string) => Promise<void>
  private logger!: IndentedLogger<Promise<void>>
  private _timeStart = new Date()
  private fileFd?: fs.FileHandle
  private options: JUnitOptions

  constructor(options: JUnitOptions) {
    this.options = { ...options }
    this.options.includeConsoleOutput ??= true
    this.options.stackTrace ??= true
  }

  async onInit(ctx: Vitest): Promise<void> {
    this.ctx = ctx

    const outputFile
      = this.options.outputFile ?? getOutputFile(this.ctx.config, 'junit')

    if (outputFile) {
      this.reportFile = resolve(this.ctx.config.root, outputFile)

      const outputDirectory = dirname(this.reportFile)
      if (!existsSync(outputDirectory)) {
        await fs.mkdir(outputDirectory, { recursive: true })
      }

      const fileFd = await fs.open(this.reportFile, 'w+')
      this.fileFd = fileFd

      this.baseLog = async (text: string) => {
        if (!this.fileFd) {
          this.fileFd = await fs.open(this.reportFile!, 'w+')
        }

        await fs.writeFile(this.fileFd, `${text}\n`)
      }
    }
    else {
      this.baseLog = async (text: string) => this.ctx.logger.log(text)
    }

    this._timeStart = new Date()
    this.logger = new IndentedLogger(this.baseLog)
  }

  async writeElement(
    name: string,
    attrs: Record<string, any>,
    children: () => Promise<void>,
  ): Promise<void> {
    const pairs: string[] = []
    for (const key in attrs) {
      const attr = attrs[key]
      if (attr === undefined) {
        continue
      }

      pairs.push(`${key}="${escapeXML(attr)}"`)
    }

    await this.logger.log(
      `<${name}${pairs.length ? ` ${pairs.join(' ')}` : ''}>`,
    )
    this.logger.indent()
    await children.call(this)
    this.logger.unindent()

    await this.logger.log(`</${name}>`)
  }

  async writeLogs(task: Task, type: 'err' | 'out'): Promise<void> {
    if (task.logs == null || task.logs.length === 0) {
      return
    }

    const logType = type === 'err' ? 'stderr' : 'stdout'
    const logs = task.logs.filter(log => log.type === logType)

    if (logs.length === 0) {
      return
    }

    await this.writeElement(`system-${type}`, {}, async () => {
      for (const log of logs) {
        await this.baseLog(escapeXML(log.content))
      }
    })
  }

  private applyTemplate(
    template: string | ((vars: ClassnameTemplateVariables) => string),
    vars: ClassnameTemplateVariables,
  ): string {
    if (typeof template === 'function') {
      return template(vars)
    }
    return template
      .replace(/\{filename\}/g, () => vars.filename)
      .replace(/\{filepath\}/g, () => vars.filepath)
      .replace(/\{basename\}/g, () => vars.basename)
      .replace(/\{classname\}/g, () => vars.classname)
      .replace(/\{title\}/g, () => vars.title)
      .replace(/\{suitename\}/g, () => vars.suitename)
      .replace(/\{displayName\}/g, () => vars.displayName)
  }

  async writeTasks(tasks: TaskWithMeta[], filename: string, fileAbsPath: string): Promise<void> {
    for (const task of tasks) {
      const fileBasename = task.file ? basename(task.file.filepath) : basename(fileAbsPath)

      const templateVars: ClassnameTemplateVariables = {
        filename: task.file?.name ?? filename,
        filepath: task.file?.filepath ?? fileAbsPath,
        basename: fileBasename,
        classname: task._classname ?? '',
        title: task._leafName ?? task.name,
        suitename: task._suitename ?? '',
        displayName: task.file?.projectName ?? '',
      }

      let classname = filename
      if (this.options.classnameTemplate) {
        classname = this.applyTemplate(this.options.classnameTemplate, templateVars)
      }

      const testcaseName = this.options.titleTemplate
        ? this.applyTemplate(this.options.titleTemplate, templateVars)
        : task.name

      await this.writeElement(
        'testcase',
        {
          classname,
          file: this.options.addFileAttribute ? filename : undefined,
          name: testcaseName,
          time: getDuration(task),
        },
        async () => {
          if (this.options.includeConsoleOutput) {
            await this.writeLogs(task, 'out')
            await this.writeLogs(task, 'err')
          }

          if (task.mode === 'skip' || task.mode === 'todo') {
            await this.logger.log('<skipped/>')
          }

          if (task.type === 'test' && task.annotations.length) {
            await this.logger.log('<properties>')
            this.logger.indent()

            for (const annotation of task.annotations) {
              await this.logger.log(
                `<property name="${escapeXML(annotation.type)}" value="${escapeXML(annotation.message)}">`,
              )
              await this.logger.log('</property>')
            }

            this.logger.unindent()
            await this.logger.log('</properties>')
          }

          if (task.result?.state === 'fail') {
            const errors = task.result.errors || []
            for (const error of errors) {
              await this.writeErrorElement('failure', error, {
                project: this.ctx.getProjectByName(task.file?.projectName ?? ''),
                task,
              })
            }
          }
        },
      )
    }
  }

  private resolveSuiteNameTemplate(
    file: { filepath: string; name: string; projectName?: string; tasks: Task[] },
    filename: string,
  ): string {
    if (!this.options.suiteNameTemplate) {
      return filename
    }

    const fileBasename = basename(file.filepath)
    const firstSuiteName = file.tasks.find(t => t.type === 'suite')?.name ?? fileBasename

    const vars: SuiteNameTemplateVariables = {
      filepath: file.filepath,
      filename,
      basename: fileBasename,
      displayName: file.projectName ?? '',
      title: firstSuiteName,
    }

    if (typeof this.options.suiteNameTemplate === 'function') {
      return this.options.suiteNameTemplate(vars)
    }
    return this.options.suiteNameTemplate
      .replace(/\{filepath\}/g, () => vars.filepath)
      .replace(/\{filename\}/g, () => vars.filename)
      .replace(/\{basename\}/g, () => vars.basename)
      .replace(/\{displayName\}/g, () => vars.displayName)
      .replace(/\{title\}/g, () => vars.title)
  }

  private async writeErrorElement(
    elementName: 'failure' | 'error',
    error: SerializedError | undefined,
    errorOptions: ErrorOptions,
  ): Promise<void> {
    await this.writeElement(
      elementName,
      {
        message: error?.message,
        type: error?.name,
      },
      async () => {
        if (!error || !this.options.stackTrace) {
          return
        }
        const result = capturePrintError(error, this.ctx, errorOptions)
        await this.baseLog(
          escapeXML(stripVTControlCharacters(result.output.trim())),
        )
      },
    )
  }

  private async writeUnhandledErrorsTestsuite(
    unhandledErrors: ReadonlyArray<UnhandledError>,
    testModules: ReadonlyArray<TestModule>,
  ): Promise<void> {
    await this.writeElement(
      'testsuite',
      {
        name: 'vitest unhandled errors',
        timestamp: new Date().toISOString(),
        hostname: this.options.hostname || hostname(),
        tests: unhandledErrors.length,
        failures: 0,
        errors: unhandledErrors.length,
        skipped: 0,
        time: '0',
      },
      async () => {
        for (const error of unhandledErrors) {
          // Prefer error.type ("Uncaught Exception" / "Unhandled Rejection") over error.name for the title.
          const errorTitle = error.type || error.name || 'Unhandled Error'
          // Match the error back to the project/task that owns it so capturePrintError
          // resolves paths against the right project root in multi-project workspaces.
          const owningModule = error.VITEST_TEST_PATH
            ? testModules.find(m => m.task.filepath === error.VITEST_TEST_PATH)
            : undefined
          await this.writeElement(
            'testcase',
            {
              classname: 'vitest unhandled errors',
              file: this.options.addFileAttribute && error.VITEST_TEST_PATH
                ? relative(this.ctx.config.root, error.VITEST_TEST_PATH)
                : undefined,
              name: error.message ? `${errorTitle}: ${error.message}` : errorTitle,
              time: '0',
            },
            async () => {
              await this.writeErrorElement('error', error, {
                project: owningModule?.project,
                task: owningModule?.task,
              })
            },
          )
        }
      },
    )
  }

  async onTestRunEnd(
    testModules: ReadonlyArray<TestModule>,
    unhandledErrors: ReadonlyArray<UnhandledError> = [],
  ): Promise<void> {
    const files = testModules.map(testModule => testModule.task)
    const separator = this.options.ancestorSeparator ?? ' > '

    await this.logger.log('<?xml version="1.0" encoding="UTF-8" ?>')

    const transformed = files.map((file) => {
      const tasks: TaskWithMeta[] = file.tasks.flatMap(task => flattenTasks(task, '', '', separator))

      const stats = tasks.reduce(
        (stats, task) => {
          return {
            passed: stats.passed + Number(task.result?.state === 'pass'),
            failures: stats.failures + Number(task.result?.state === 'fail'),
            skipped:
              stats.skipped
              + Number(task.mode === 'skip' || task.mode === 'todo'),
          }
        },
        {
          passed: 0,
          failures: 0,
          skipped: 0,
        },
      )

      // inject failed suites to surface errors during beforeAll/afterAll
      const suites = getSuites(file)
      for (const suite of suites) {
        if (suite.result?.errors) {
          tasks.push(suite)
          stats.failures += 1
        }
      }

      // If there are no tests, but the file failed to load, we still want to report it as a failure
      if (tasks.length === 0 && file.result?.state === 'fail') {
        stats.failures = 1

        tasks.push({
          id: file.id,
          type: 'test',
          name: file.name,
          fullName: file.name,
          fullTestName: file.name,
          mode: 'run',
          result: file.result,
          meta: {},
          timeout: 0,
          // NOTE: not used in JUnitReporter
          context: null as any,
          suite: null as any,
          file: null as any,
          annotations: [],
          artifacts: [],
        } satisfies Task)
      }

      return {
        ...file,
        tasks,
        stats,
      }
    })

    const stats = transformed.reduce(
      (stats, file) => {
        stats.tests += file.tasks.length
        stats.failures += file.stats.failures
        stats.time += file.result?.duration || 0
        return stats
      },
      {
        name: this.options.suiteName || 'vitest tests',
        tests: 0,
        failures: 0,
        errors: unhandledErrors.length,
        time: 0,
      },
    )
    stats.tests += unhandledErrors.length

    await this.writeElement('testsuites', { ...stats, time: executionTime(stats.time) }, async () => {
      for (let i = 0; i < transformed.length; i++) {
        const file = transformed[i]
        const filename = relative(this.ctx.config.root, file.filepath)
        // resolveSuiteNameTemplate needs the original file (before task flattening) to
        // search for top-level describe blocks, so pass files[i] directly.
        const suiteName = this.resolveSuiteNameTemplate(files[i], filename)
        await this.writeElement(
          'testsuite',
          {
            name: suiteName,
            timestamp: new Date().toISOString(),
            hostname: this.options.hostname || hostname(),
            tests: file.tasks.length,
            failures: file.stats.failures,
            errors: 0, // An errored test is one that had an unanticipated problem. We cannot detect those.
            skipped: file.stats.skipped,
            time: getDuration(file),
          },
          async () => {
            await this.writeTasks(file.tasks, filename, file.filepath)
          },
        )
      }

      if (unhandledErrors.length) {
        await this.writeUnhandledErrorsTestsuite(unhandledErrors, testModules)
      }
    })

    if (this.reportFile) {
      this.ctx.logger.log(`JUNIT report written to ${this.reportFile}`)
    }

    await this.fileFd?.close()
    this.fileFd = undefined
  }
}
