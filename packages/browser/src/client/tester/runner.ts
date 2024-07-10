import type { CancelReason, File, Suite, Task, TaskResultPack, VitestRunner } from '@vitest/runner'
import type { ResolvedConfig, WorkerGlobalState } from 'vitest'
import type { VitestExecutor } from 'vitest/execute'
import { NodeBenchmarkRunner, VitestTestRunner } from 'vitest/runners'
import { loadDiffConfig, loadSnapshotSerializers, takeCoverageInsideWorker } from 'vitest/browser'
import { TraceMap, originalPositionFor } from 'vitest/utils'
import { page } from '@vitest/browser/context'
import { globalChannel } from '@vitest/browser/client'
import { importFs, importId } from '../utils'
import { VitestBrowserSnapshotEnvironment } from './snapshot'
import { rpc } from './rpc'
import type { VitestBrowserClientMocker } from './mocker'

interface BrowserRunnerOptions {
  config: ResolvedConfig
}

export const browserHashMap = new Map<
  string,
  [test: boolean, timstamp: string]
>()

interface CoverageHandler {
  takeCoverage: () => Promise<unknown>
}

export function createBrowserRunner(
  runnerClass: { new (config: ResolvedConfig): VitestRunner },
  mocker: VitestBrowserClientMocker,
  state: WorkerGlobalState,
  coverageModule: CoverageHandler | null,
): { new (options: BrowserRunnerOptions): VitestRunner } {
  return class BrowserTestRunner extends runnerClass implements VitestRunner {
    public config: ResolvedConfig
    hashMap = browserHashMap
    public sourceMapCache = new Map<string, any>()

    constructor(options: BrowserRunnerOptions) {
      super(options.config)
      this.config = options.config
    }

    onAfterRunTask = async (task: Task) => {
      await super.onAfterRunTask?.(task)

      if (this.config.bail && task.result?.state === 'fail') {
        const previousFailures = await rpc().getCountOfFailedTests()
        const currentFailures = 1 + previousFailures

        if (currentFailures >= this.config.bail) {
          rpc().onCancel('test-failure')
          this.onCancel('test-failure')
        }
      }
    }

    onTaskFinished = async (task: Task) => {
      if (this.config.browser.screenshotFailures && task.result?.state === 'fail') {
        task.meta.failScreenshotPath = await page.screenshot()
      }
    }

    onCancel = (reason: CancelReason) => {
      super.onCancel?.(reason)
      globalChannel.postMessage({ type: 'cancel', reason })
    }

    onBeforeRunSuite = async (suite: Suite | File) => {
      await Promise.all([
        super.onBeforeRunSuite?.(suite),
        (async () => {
          if ('filepath' in suite) {
            const map = await rpc().getBrowserFileSourceMap(suite.filepath)
            this.sourceMapCache.set(suite.filepath, map)
            const snapshotEnvironment = this.config.snapshotOptions.snapshotEnvironment
            if (snapshotEnvironment instanceof VitestBrowserSnapshotEnvironment) {
              snapshotEnvironment.addSourceMap(suite.filepath, map)
            }
          }
        })(),
      ])
    }

    onAfterRunFiles = async (files: File[]) => {
      const [coverage] = await Promise.all([
        coverageModule?.takeCoverage?.(),
        mocker.invalidate(),
        super.onAfterRunFiles?.(files),
      ])

      if (coverage) {
        await rpc().onAfterSuiteRun({
          coverage,
          transformMode: 'web',
          projectName: this.config.name,
        })
      }
    }

    onCollected = async (files: File[]): Promise<unknown> => {
      files.forEach((file) => {
        file.prepareDuration = state.durations.prepare
        file.environmentLoad = state.durations.environment
        // should be collected only for a single test file in a batch
        state.durations.prepare = 0
        state.durations.environment = 0
      })

      if (this.config.includeTaskLocation) {
        try {
          await updateFilesLocations(files, this.sourceMapCache)
        }
        catch (_) {}
      }
      return rpc().onCollected(files)
    }

    onTaskUpdate = (task: TaskResultPack[]): Promise<void> => {
      return rpc().onTaskUpdate(task)
    }

    importFile = async (filepath: string) => {
      let [test, hash] = this.hashMap.get(filepath) ?? [false, '']
      if (hash === '') {
        hash = Date.now().toString()
        this.hashMap.set(filepath, [false, hash])
      }

      // on Windows we need the unit to resolve the test file
      const prefix = `/${/^\w:/.test(filepath) ? '@fs/' : ''}`
      const query = `${test ? 'browserv' : 'v'}=${hash}`
      const importpath = `${prefix}${filepath}?${query}`.replace(/\/+/g, '/')
      await import(/* @vite-ignore */ importpath)
    }
  }
}

let cachedRunner: VitestRunner | null = null

export async function initiateRunner(
  state: WorkerGlobalState,
  mocker: VitestBrowserClientMocker,
  config: ResolvedConfig,
) {
  if (cachedRunner) {
    return cachedRunner
  }
  const runnerClass
    = config.mode === 'test' ? VitestTestRunner : NodeBenchmarkRunner

  const executeId = (id: string) => {
    if (id[0] === '/' || id[1] === ':') {
      return importFs(id)
    }
    return importId(id)
  }

  const BrowserRunner = createBrowserRunner(runnerClass, mocker, state, {
    takeCoverage: () =>
      takeCoverageInsideWorker(config.coverage, { executeId }),
  })
  if (!config.snapshotOptions.snapshotEnvironment) {
    config.snapshotOptions.snapshotEnvironment = new VitestBrowserSnapshotEnvironment()
  }
  const runner = new BrowserRunner({
    config,
  })
  const executor = { executeId } as VitestExecutor
  const [diffOptions] = await Promise.all([
    loadDiffConfig(config, executor),
    loadSnapshotSerializers(config, executor),
  ])
  runner.config.diffOptions = diffOptions
  cachedRunner = runner
  return runner
}

async function updateFilesLocations(files: File[], sourceMaps: Map<string, any>) {
  const promises = files.map(async (file) => {
    const result = sourceMaps.get(file.filepath) || await rpc().getBrowserFileSourceMap(file.filepath)
    if (!result) {
      return null
    }
    const traceMap = new TraceMap(result as any)
    function updateLocation(task: Task) {
      if (task.location) {
        const { line, column } = originalPositionFor(traceMap, task.location)
        if (line != null && column != null) {
          task.location = { line, column: task.each ? column : column + 1 }
        }
      }
      if ('tasks' in task) {
        task.tasks.forEach(updateLocation)
      }
    }
    file.tasks.forEach(updateLocation)
    return null
  })

  await Promise.all(promises)
}
