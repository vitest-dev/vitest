import type { CancelReason, File, Suite, Task, TaskEventPack, TaskResultPack, VitestRunner } from '@vitest/runner'
import type { SerializedConfig, TestExecutionMethod, WorkerGlobalState } from 'vitest'
import type { VitestExecutor } from 'vitest/execute'
import type { VitestBrowserClientMocker } from './mocker'
import { globalChannel, onCancel } from '@vitest/browser/client'
import { page, userEvent } from '@vitest/browser/context'
import { loadDiffConfig, loadSnapshotSerializers, takeCoverageInsideWorker } from 'vitest/browser'
import { NodeBenchmarkRunner, VitestTestRunner } from 'vitest/runners'
import { originalPositionFor, TraceMap } from 'vitest/utils'
import { createStackString, parseStacktrace } from '../../../../utils/src/source-map'
import { executor, getWorkerState } from '../utils'
import { rpc } from './rpc'
import { VitestBrowserSnapshotEnvironment } from './snapshot'

interface BrowserRunnerOptions {
  config: SerializedConfig
}

export const browserHashMap: Map<string, string> = new Map()

interface CoverageHandler {
  takeCoverage: () => Promise<unknown>
}

interface BrowserVitestRunner extends VitestRunner {
  sourceMapCache: Map<string, any>
  method: TestExecutionMethod
  setMethod: (method: TestExecutionMethod) => void
}

export function createBrowserRunner(
  runnerClass: { new (config: SerializedConfig): VitestRunner },
  mocker: VitestBrowserClientMocker,
  state: WorkerGlobalState,
  coverageModule: CoverageHandler | null,
): { new (options: BrowserRunnerOptions): BrowserVitestRunner } {
  return class BrowserTestRunner extends runnerClass implements VitestRunner {
    public config: SerializedConfig
    hashMap = browserHashMap
    public sourceMapCache = new Map<string, any>()
    public method = 'run' as TestExecutionMethod

    constructor(options: BrowserRunnerOptions) {
      super(options.config)
      this.config = options.config
    }

    setMethod(method: TestExecutionMethod) {
      this.method = method
    }

    onBeforeTryTask: VitestRunner['onBeforeTryTask'] = async (...args) => {
      await userEvent.cleanup()
      await super.onBeforeTryTask?.(...args)
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
      if (this.config.browser.screenshotFailures && document.body.clientHeight > 0 && task.result?.state === 'fail') {
        const screenshot = await page.screenshot({
          timeout: this.config.browser.providerOptions?.actionTimeout ?? 5_000,
        }).catch((err) => {
          console.error('[vitest] Failed to take a screenshot', err)
        })
        if (screenshot) {
          task.meta.failScreenshotPath = screenshot
        }
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
          testFiles: files.map(file => file.name),
          transformMode: 'browser',
          projectName: this.config.name,
        })
      }
    }

    onCollectStart = (file: File) => {
      return rpc().onQueued(this.method, file)
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
          await updateTestFilesLocations(files, this.sourceMapCache)
        }
        catch {}
      }
      return rpc().onCollected(this.method, files)
    }

    onTaskUpdate = (task: TaskResultPack[], events: TaskEventPack[]): Promise<void> => {
      return rpc().onTaskUpdate(this.method, task, events)
    }

    importFile = async (filepath: string) => {
      let hash = this.hashMap.get(filepath)
      if (!hash) {
        hash = Date.now().toString()
        this.hashMap.set(filepath, hash)
      }

      // on Windows we need the unit to resolve the test file
      const prefix = `/${/^\w:/.test(filepath) ? '@fs/' : ''}`
      const query = `browserv=${hash}`
      const importpath = `${prefix}${filepath}?${query}`.replace(/\/+/g, '/')
      await import(/* @vite-ignore */ importpath)
    }
  }
}

let cachedRunner: BrowserVitestRunner | null = null

export function getBrowserRunner(): BrowserVitestRunner | null {
  return cachedRunner
}

export async function initiateRunner(
  state: WorkerGlobalState,
  mocker: VitestBrowserClientMocker,
  config: SerializedConfig,
): Promise<BrowserVitestRunner> {
  if (cachedRunner) {
    return cachedRunner
  }
  const runnerClass
    = config.mode === 'test' ? VitestTestRunner : NodeBenchmarkRunner

  const BrowserRunner = createBrowserRunner(runnerClass, mocker, state, {
    takeCoverage: () =>
      takeCoverageInsideWorker(config.coverage, executor),
  })
  if (!config.snapshotOptions.snapshotEnvironment) {
    config.snapshotOptions.snapshotEnvironment = new VitestBrowserSnapshotEnvironment()
  }
  const runner = new BrowserRunner({
    config,
  })
  cachedRunner = runner

  onCancel.then((reason) => {
    runner.onCancel?.(reason)
  })

  const [diffOptions] = await Promise.all([
    loadDiffConfig(config, executor as unknown as VitestExecutor),
    loadSnapshotSerializers(config, executor as unknown as VitestExecutor),
  ])
  runner.config.diffOptions = diffOptions
  getWorkerState().onFilterStackTrace = (stack: string) => {
    const stacks = parseStacktrace(stack, {
      getSourceMap(file) {
        return runner.sourceMapCache.get(file)
      },
    })
    return createStackString(stacks)
  }
  return runner
}

async function updateTestFilesLocations(files: File[], sourceMaps: Map<string, any>) {
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
