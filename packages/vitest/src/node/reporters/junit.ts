import { existsSync, promises as fs } from 'node:fs'
import { hostname } from 'node:os'
import { dirname, relative, resolve } from 'pathe'

import type { Task } from '@vitest/runner'
import { getSuites } from '@vitest/runner/utils'
import stripAnsi from 'strip-ansi'
import type { Vitest } from '../../node'
import type { Reporter } from '../../types/reporter'
import { getOutputFile } from '../../utils/config-helpers'
import { capturePrintError } from '../error'
import { IndentedLogger } from './renderers/indented-logger'

export interface JUnitOptions {
  outputFile?: string
  classname?: string
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
}

function flattenTasks(task: Task, baseName = ''): Task[] {
  const base = baseName ? `${baseName} > ` : ''

  if (task.type === 'suite') {
    return task.tasks.flatMap(child =>
      flattenTasks(child, `${base}${task.name}`),
    )
  }
  else {
    return [
      {
        ...task,
        name: `${base}${task.name}`,
      },
    ]
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
  ) {
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

  async writeTasks(tasks: Task[], filename: string): Promise<void> {
    for (const task of tasks) {
      await this.writeElement(
        'testcase',
        {
          classname: this.options.classname ?? filename,
          file: this.options.addFileAttribute ? filename : undefined,
          name: task.name,
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

          if (task.result?.state === 'fail') {
            const errors = task.result.errors || []
            for (const error of errors) {
              await this.writeElement(
                'failure',
                {
                  message: error?.message,
                  type: error?.name ?? error?.nameStr,
                },
                async () => {
                  if (!error) {
                    return
                  }

                  const result = capturePrintError(
                    error,
                    this.ctx,
                    this.ctx.getProjectByTaskId(task.id),
                  )
                  await this.baseLog(
                    escapeXML(stripAnsi(result.output.trim())),
                  )
                },
              )
            }
          }
        },
      )
    }
  }

  async onFinished(files = this.ctx.state.getFiles()) {
    await this.logger.log('<?xml version="1.0" encoding="UTF-8" ?>')

    const transformed = files.map((file) => {
      const tasks = file.tasks.flatMap(task => flattenTasks(task))

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
          mode: 'run',
          result: file.result,
          meta: {},
          // NOTE: not used in JUnitReporter
          context: null as any,
          suite: null as any,
          file: null as any,
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
        return stats
      },
      {
        name: this.options.suiteName || 'vitest tests',
        tests: 0,
        failures: 0,
        errors: 0, // we cannot detect those
        time: executionTime(new Date().getTime() - this._timeStart.getTime()),
      },
    )

    await this.writeElement('testsuites', stats, async () => {
      for (const file of transformed) {
        const filename = relative(this.ctx.config.root, file.filepath)
        await this.writeElement(
          'testsuite',
          {
            name: filename,
            timestamp: new Date().toISOString(),
            hostname: hostname(),
            tests: file.tasks.length,
            failures: file.stats.failures,
            errors: 0, // An errored test is one that had an unanticipated problem. We cannot detect those.
            skipped: file.stats.skipped,
            time: getDuration(file),
          },
          async () => {
            await this.writeTasks(file.tasks, filename)
          },
        )
      }
    })

    if (this.reportFile) {
      this.ctx.logger.log(`JUNIT report written to ${this.reportFile}`)
    }

    await this.fileFd?.close()
    this.fileFd = undefined
  }
}
