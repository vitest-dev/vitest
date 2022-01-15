import { promises as fs } from 'fs'
import { hostname } from 'os'
import { relative, resolve } from 'pathe'

import type { Vitest } from '../../node'
import type { ErrorWithDiff, Reporter, Task } from '../../types'
import { parseStacktrace } from '../../utils/source-map'
import { F_POINTER } from './renderers/figures'
import { IndentedLogger } from './utils/indented-logger'

function flattenTasks(task: Task, baseName = ''): Task[] {
  const base = baseName ? `${baseName} > ` : ''

  if (task.type === 'suite' && task.tasks.length > 0) {
    return task.tasks.flatMap(child => flattenTasks(child, `${base}${task.name}`))
  }
  else {
    return [{
      ...task,
      name: `${base}${task.name}`,
    }]
  }
}

function escapeXML(value: any): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&apos;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function openTag(name: string, attrs: Record<string, any>) {
  const pairs = []

  for (const key in attrs) {
    const attr = attrs[key]
    if (attr === undefined)
      continue

    pairs.push(`${key}="${escapeXML(attr)}"`)
  }

  return `<${name}${pairs.length ? ` ${pairs.join(' ')}` : ''}>`
}

function getDuration(task: Task): string | undefined {
  return task.result?.duration ? (task.result.duration / 1000).toFixed(10) : undefined
}

export class JUnitReporter implements Reporter {
  private ctx!: Vitest
  private reportFile?: string
  private baseLog!: (text: string) => Promise<void>
  private logger!: IndentedLogger<Promise<void>>

  async onInit(ctx: Vitest): Promise<void> {
    this.ctx = ctx

    if (this.ctx.config.outputFile) {
      this.reportFile = resolve(this.ctx.config.root, this.ctx.config.outputFile)
      const fileFd = await fs.open(this.reportFile, 'w+')

      this.baseLog = async(text: string) => await fs.writeFile(fileFd, `${text}\n`)
    }
    else {
      this.baseLog = async(text: string) => this.ctx.log(text)
    }

    this.logger = new IndentedLogger(this.baseLog)
  }

  async logError(error: ErrorWithDiff): Promise<void> {
    const errorName = error.name ?? error.nameStr ?? 'Unknown Error'
    await this.baseLog(`${errorName}: ${error.message}`)

    const stack = parseStacktrace(error)

    // TODO: This is same as printStack but without colors. Find a way to reuse code.
    for (const frame of stack) {
      const pos = frame.sourcePos ?? frame
      const path = relative(this.ctx.config.root, frame.file)

      await this.baseLog(` ${F_POINTER} ${[frame.method, `${path}:${pos.line}:${pos.column}`].filter(Boolean).join(' ')}`)

      // reached at test file, skip the follow stack
      if (frame.file in this.ctx.state.filesMap)
        break
    }
  }

  async logLogs(task: Task, type: 'err' | 'out'): Promise<void> {
    if (task.logs == null || task.logs.length === 0)
      return

    const logType = type === 'err' ? 'stderr' : 'stdout'
    const logs = task.logs.filter(log => log.type === logType)

    if (logs.length > 0) {
      await this.logger.log(`<system-${type}>`)
      for (const log of logs)
        await this.baseLog(escapeXML(log.content))
      await this.logger.log(`</system-${type}>`)
    }
  }

  async writeTasks(tasks: Task[], filename: string): Promise<void> {
    for (const task of tasks) {
      await this.logger.log(openTag('testcase', {
        classname: filename,
        name: task.name,
        time: getDuration(task),
      }))

      this.logger.indent()

      await this.logLogs(task, 'out')
      await this.logLogs(task, 'err')

      if (task.mode === 'skip' || task.mode === 'todo')
        this.logger.log('<skipped/>')

      if (task.result?.state === 'fail') {
        const error = task.result.error

        await this.logger.log(openTag('failure', {
          message: error?.message,
          type: error?.name ?? error?.nameStr,
        }))

        if (error)
          await this.logError(error)

        await this.logger.log('</failure>')
      }

      this.logger.unindent()

      await this.logger.log('</testcase>')
    }
  }

  async onFinished(files = this.ctx.state.getFiles()) {
    await this.logger.log('<?xml version="1.0" encoding="UTF-8" ?>')

    const transformed = files
      .map((file) => {
        const tasks = file.tasks.flatMap(task => flattenTasks(task))

        const stats = tasks.reduce((stats, task) => {
          return {
            passed: stats.passed + Number(task.result?.state === 'pass'),
            failures: stats.failures + Number(task.result?.state === 'fail'),
            skipped: stats.skipped + Number(task.mode === 'skip' || task.mode === 'todo'),
          }
        },
        {
          passed: 0,
          failures: 0,
          skipped: 0,
        })

        return {
          ...file,
          stats,
        }
      })

    await this.logger.log('<testsuites>')
    this.logger.indent()

    for (const file of transformed) {
      await this.logger.log(openTag('testsuite', {
        name: file.name,
        timestamp: (new Date()).toISOString(),
        hostname: hostname(),
        tests: file.tasks.length,
        failures: file.stats.failures,
        errors: 0, // An errored test is one that had an unanticipated problem. We cannot detect those.
        skipped: file.stats.skipped,
        time: getDuration(file),
      }))

      this.logger.indent()
      await this.writeTasks(file.tasks, file.name)
      this.logger.unindent()

      await this.logger.log('</testsuite>')
    }

    this.logger.unindent()
    await this.logger.log('</testsuites>')

    if (this.reportFile)
      this.ctx.log(`JUNIT report written to ${this.reportFile}`)
  }
}
