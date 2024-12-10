import type { File, TaskResultPack, TaskState, Test } from '@vitest/runner'
import type { Vitest } from '../core'
import { getTests } from '@vitest/runner/utils'
import c from 'tinyrainbow'
import { BaseReporter } from './base'
import { WindowRenderer } from './renderers/windowedRenderer'
import { TaskParser } from './task-parser'

interface Icon {
  char: string
  color: (char: string) => string
}

export class DotReporter extends BaseReporter {
  private summary?: DotSummary

  onInit(ctx: Vitest) {
    super.onInit(ctx)

    if (this.isTTY) {
      this.summary = new DotSummary()
      this.summary.onInit(ctx)
    }
  }

  onTaskUpdate(packs: TaskResultPack[]) {
    this.summary?.onTaskUpdate(packs)

    if (!this.isTTY) {
      super.onTaskUpdate(packs)
    }
  }

  onWatcherRerun(files: string[], trigger?: string) {
    this.summary?.onWatcherRerun()
    super.onWatcherRerun(files, trigger)
  }

  onFinished(files?: File[], errors?: unknown[]) {
    this.summary?.onFinished()
    super.onFinished(files, errors)
  }
}

class DotSummary extends TaskParser {
  private renderer!: WindowRenderer
  private tests = new Map<Test['id'], TaskState>()
  private finishedTests = new Set<Test['id']>()

  onInit(ctx: Vitest): void {
    this.ctx = ctx

    this.renderer = new WindowRenderer({
      logger: ctx.logger,
      getWindow: () => this.createSummary(),
    })

    this.ctx.onClose(() => this.renderer.stop())
  }

  onWatcherRerun() {
    this.tests.clear()
    this.renderer.start()
  }

  onFinished() {
    const finalLog = formatTests(Array.from(this.tests.values()))
    this.ctx.logger.log(finalLog)

    this.tests.clear()
    this.renderer.finish()
  }

  onTestFilePrepare(file: File): void {
    for (const test of getTests(file)) {
      // Dot reporter marks pending tests as running
      this.onTestStart(test)
    }
  }

  onTestStart(test: Test) {
    if (this.finishedTests.has(test.id)) {
      return
    }

    this.tests.set(test.id, test.mode || 'run')
  }

  onTestFinished(test: Test) {
    if (this.finishedTests.has(test.id)) {
      return
    }

    this.finishedTests.add(test.id)
    this.tests.set(test.id, test.result?.state || 'skip')
  }

  onTestFileFinished() {
    const columns = this.renderer.getColumns()

    if (this.tests.size < columns) {
      return
    }

    const finishedTests = Array.from(this.tests).filter(entry => entry[1] !== 'run')

    if (finishedTests.length < columns) {
      return
    }

    // Remove finished tests from state and render them in static output
    const states: TaskState[] = []
    let count = 0

    for (const [id, state] of finishedTests) {
      if (count++ >= columns) {
        break
      }

      this.tests.delete(id)
      states.push(state)
    }

    this.ctx.logger.log(formatTests(states))
  }

  private createSummary() {
    return [
      formatTests(Array.from(this.tests.values())),
      '',
    ]
  }
}

// These are compared with reference equality in formatTests
const pass: Icon = { char: '·', color: c.green }
const fail: Icon = { char: 'x', color: c.red }
const pending: Icon = { char: '*', color: c.yellow }
const skip: Icon = { char: '-', color: (char: string) => c.dim(c.gray(char)) }

function getIcon(state: TaskState): Icon {
  switch (state) {
    case 'pass':
      return pass
    case 'fail':
      return fail
    case 'skip':
    case 'todo':
      return skip
    default:
      return pending
  }
}

/**
 * Format test states into string while keeping ANSI escapes at minimal.
 * Sibling icons with same color are merged into a single c.color() call.
 */
function formatTests(states: TaskState[]): string {
  let currentIcon = pending
  let count = 0
  let output = ''

  for (const state of states) {
    const icon = getIcon(state)

    if (currentIcon === icon) {
      count++
      continue
    }

    output += currentIcon.color(currentIcon.char.repeat(count))

    // Start tracking new group
    count = 1
    currentIcon = icon
  }

  output += currentIcon.color(currentIcon.char.repeat(count))

  return output
}
