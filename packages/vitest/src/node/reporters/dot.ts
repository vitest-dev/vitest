import type { File, Task, Test } from '@vitest/runner'
import type { Vitest } from '../core'
import type { TestCase, TestModule } from './reported-tasks'
import c from 'tinyrainbow'
import { BaseReporter } from './base'
import { WindowRenderer } from './renderers/windowedRenderer'

interface Icon {
  char: string
  color: (char: string) => string
}

type TestCaseState = ReturnType<TestCase['result']>['state']

export class DotReporter extends BaseReporter {
  private renderer?: WindowRenderer
  private tests = new Map<Test['id'], TestCaseState>()
  private finishedTests = new Set<TestCase['id']>()

  onInit(ctx: Vitest) {
    super.onInit(ctx)

    if (this.isTTY) {
      this.renderer = new WindowRenderer({
        logger: ctx.logger,
        getWindow: () => this.createSummary(),
      })

      this.ctx.onClose(() => this.renderer?.stop())
    }
  }

  printTask(task: Task) {
    if (!this.isTTY) {
      super.printTask(task)
    }
  }

  onWatcherRerun(files: string[], trigger?: string) {
    this.tests.clear()
    this.renderer?.start()
    super.onWatcherRerun(files, trigger)
  }

  onFinished(files?: File[], errors?: unknown[]) {
    if (this.isTTY) {
      const finalLog = formatTests(Array.from(this.tests.values()))
      this.ctx.logger.log(finalLog)
    }

    this.tests.clear()
    this.renderer?.finish()

    super.onFinished(files, errors)
  }

  onTestModuleCollected(module: TestModule): void {
    for (const test of module.children.allTests()) {
      // Dot reporter marks pending tests as running
      this.onTestCaseReady(test)
    }
  }

  onTestCaseReady(test: TestCase) {
    if (this.finishedTests.has(test.id)) {
      return
    }
    this.tests.set(test.id, test.result().state || 'run')
    this.renderer?.schedule()
  }

  onTestCaseResult(test: TestCase) {
    this.finishedTests.add(test.id)
    this.tests.set(test.id, test.result().state || 'skipped')
    this.renderer?.schedule()
  }

  onTestModuleEnd() {
    if (!this.isTTY) {
      return
    }

    const columns = this.ctx.logger.getColumns()

    if (this.tests.size < columns) {
      return
    }

    const finishedTests = Array.from(this.tests).filter(entry => entry[1] !== 'pending')

    if (finishedTests.length < columns) {
      return
    }

    // Remove finished tests from state and render them in static output
    const states: TestCaseState[] = []
    let count = 0

    for (const [id, state] of finishedTests) {
      if (count++ >= columns) {
        break
      }

      this.tests.delete(id)
      states.push(state)
    }

    this.ctx.logger.log(formatTests(states))
    this.renderer?.schedule()
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

function getIcon(state: TestCaseState): Icon {
  switch (state) {
    case 'passed':
      return pass
    case 'failed':
      return fail
    case 'skipped':
      return skip
    default:
      return pending
  }
}

/**
 * Format test states into string while keeping ANSI escapes at minimal.
 * Sibling icons with same color are merged into a single c.color() call.
 */
function formatTests(states: TestCaseState[]): string {
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
