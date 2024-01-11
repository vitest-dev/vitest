import type { File, TaskResultPack, Test, VitestRunner } from '@vitest/runner'
import type { ResolvedConfig } from 'vitest'
import { rpc } from './rpc'

interface BrowserRunnerOptions {
  config: ResolvedConfig
  browserHashMap: Map<string, [test: boolean, timstamp: string]>
}

interface CoverageHandler {
  takeCoverage: () => Promise<unknown>
}

export function createBrowserRunner(
  VitestRunner: { new(config: ResolvedConfig): VitestRunner },
  coverageModule: CoverageHandler | null,
): { new(options: BrowserRunnerOptions): VitestRunner } {
  return class BrowserTestRunner extends VitestRunner {
    public config: ResolvedConfig
    hashMap = new Map<string, [test: boolean, timstamp: string]>()

    constructor(options: BrowserRunnerOptions) {
      super(options.config)
      this.config = options.config
      this.hashMap = options.browserHashMap
    }

    async onAfterRunTask(task: Test) {
      await super.onAfterRunTask?.(task)
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

    async onAfterRunFiles(files: File[]) {
      await super.onAfterRunFiles?.(files)
      const coverage = await coverageModule?.takeCoverage?.()

      if (coverage) {
        await rpc().onAfterSuiteRun({
          coverage,
          transformMode: 'web',
          projectName: this.config.name,
        })
      }
    }

    onCollected(files: File[]): unknown {
      return rpc().onCollected(files)
    }

    onTaskUpdate(task: TaskResultPack[]): Promise<void> {
      return rpc().onTaskUpdate(task)
    }

    async importFile(filepath: string) {
      let [test, hash] = this.hashMap.get(filepath) ?? [false, '']
      if (hash === '') {
        hash = Date.now().toString()
        this.hashMap.set(filepath, [false, hash])
      }
      const base = this.config.base || '/'

      // on Windows we need the unit to resolve the test file
      const prefix = `${base}${/^\w:/.test(filepath) ? '@fs/' : ''}`
      const query = `${test ? 'browserv' : 'v'}=${hash}`
      const importpath = `${prefix}${filepath}?${query}`.replace(/\/+/g, '/')
      await import(importpath)
    }
  }
}
