import type { File, TaskResultPack, Test, VitestRunner } from '@vitest/runner'
import type { ResolvedConfig } from 'vitest'
import type { VitestExecutor } from 'vitest/execute'
import { rpc } from './rpc'
import { getConfig, importId } from './utils'
import { BrowserSnapshotEnvironment } from './snapshot'

interface BrowserRunnerOptions {
  config: ResolvedConfig
}

export const browserHashMap = new Map<string, [test: boolean, timstamp: string]>()

interface CoverageHandler {
  takeCoverage: () => Promise<unknown>
}

export function createBrowserRunner(
  VitestRunner: { new(config: ResolvedConfig): VitestRunner },
  coverageModule: CoverageHandler | null,
): { new(options: BrowserRunnerOptions): VitestRunner } {
  return class BrowserTestRunner extends VitestRunner {
    public config: ResolvedConfig
    hashMap = browserHashMap

    constructor(options: BrowserRunnerOptions) {
      super(options.config)
      this.config = options.config
    }

    async onAfterRunTask(task: Test) {
      await super.onAfterRunTask?.(task)

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

let cachedRunner: VitestRunner | null = null

export async function initiateRunner() {
  if (cachedRunner)
    return cachedRunner
  const config = getConfig()
  const [{ VitestTestRunner }, { takeCoverageInsideWorker, loadDiffConfig, loadSnapshotSerializers }] = await Promise.all([
    importId('vitest/runners') as Promise<typeof import('vitest/runners')>,
    importId('vitest/browser') as Promise<typeof import('vitest/browser')>,
  ])
  const BrowserRunner = createBrowserRunner(VitestTestRunner, {
    takeCoverage: () => takeCoverageInsideWorker(config.coverage, { executeId: importId }),
  })
  if (!config.snapshotOptions.snapshotEnvironment)
    config.snapshotOptions.snapshotEnvironment = new BrowserSnapshotEnvironment()
  const runner = new BrowserRunner({
    config,
  })
  const executor = { executeId: importId } as VitestExecutor
  const [diffOptions] = await Promise.all([
    loadDiffConfig(config, executor),
    loadSnapshotSerializers(config, executor),
  ])
  runner.config.diffOptions = diffOptions
  cachedRunner = runner
  return runner
}
