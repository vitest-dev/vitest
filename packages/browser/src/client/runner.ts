import type { File, TaskResult, Test } from '@vitest/runner'
import { rpc } from './rpc'
import type { ResolvedConfig } from '#types'

interface BrowserRunnerOptions {
  vitestBC: BroadcastChannel
  config: ResolvedConfig
  browserHashMap: Map<string, [test: boolean, timstamp: string]>
}

interface CoverageHandler {
  takeCoverage: () => Promise<unknown>
}

export function createBrowserRunner(original: any, coverageModule: CoverageHandler | null) {
  return class BrowserTestRunner extends original {
    public config: ResolvedConfig
    vitestBC: BroadcastChannel
    hashMap = new Map<string, [test: boolean, timestamp: string]>()

    constructor(options: BrowserRunnerOptions) {
      super(options.config)
      this.config = options.config
      this.hashMap = options.browserHashMap
      this.vitestBC = options.vitestBC
    }

    async onAfterRunTest(task: Test) {
      await super.onAfterRunTest?.(task)
      task.result?.errors?.forEach((error) => {
        console.error(error.message)
      })

      if (this.config.bail && task.result?.state === 'fail') {
        const previousFailures = await rpc().getCountOfFailedTests()
        const currentFailures = 1 + previousFailures

        if (currentFailures >= this.config.bail) {
          rpc().onCancel('test-failure')
          this.onCancel?.('test-failure')
        }
      }
    }

    async onAfterRunSuite() {
      await super.onAfterRunSuite?.()
      const coverage = await coverageModule?.takeCoverage?.()
      await rpc().onAfterSuiteRun({ coverage })
    }

    onCollected(files: File[]): unknown {
      return rpc().onCollected(files)
    }

    onTaskUpdate(task: [string, TaskResult | undefined][]): Promise<void> {
      return rpc().onTaskUpdate(task)
    }

    async importFile(filepath: string) {
      let [test, hash] = this.hashMap.get(filepath) ?? [false, '']
      if (hash === '') {
        hash = Date.now().toString()
        this.hashMap.set(filepath, [false, hash])
      }

      // on Windows we need the unit to resolve the test file
      const importpath = /^\w:/.test(filepath)
        ? `/@fs/${filepath}?${test ? 'browserv' : 'v'}=${hash}`
        : `${filepath}?${test ? 'browserv' : 'v'}=${hash}`
      await import(importpath)
    }
  }
}
