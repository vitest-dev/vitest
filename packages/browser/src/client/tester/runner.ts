import type { CancelReason, File, Suite, Task, TaskEventPack, TaskResultPack, Test, TestAnnotation, VitestRunner } from '@vitest/runner'
import type { SerializedConfig, TestExecutionMethod, WorkerGlobalState } from 'vitest'
import type { VitestBrowserClientMocker } from './mocker'
import { globalChannel, onCancel } from '@vitest/browser/client'
import { page, userEvent } from '@vitest/browser/context'
import {
  loadDiffConfig,
  loadSnapshotSerializers,
  originalPositionFor,
  takeCoverageInsideWorker,
  TraceMap,
} from 'vitest/internal/browser'
import { NodeBenchmarkRunner, VitestTestRunner } from 'vitest/runners'
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

    onAfterRunTask = async (task: Test) => {
      await super.onAfterRunTask?.(task)

      if (this.config.bail && task.result?.state === 'fail') {
        const previousFailures = await rpc().getCountOfFailedTests()
        const currentFailures = 1 + previousFailures

        if (currentFailures >= this.config.bail) {
          rpc().cancelCurrentRun('test-failure')
          this.cancel('test-failure')
        }
      }
    }

    onTaskFinished = async (task: Task) => {
      if (this.config.browser.screenshotFailures && document.body.clientHeight > 0 && task.result?.state === 'fail') {
        const screenshot = await page.screenshot({
          timeout: this.config.browser.providerOptions?.actionTimeout ?? 5_000,
        } as any /** TODO */).catch((err) => {
          console.error('[vitest] Failed to take a screenshot', err)
        })
        if (screenshot) {
          task.meta.failScreenshotPath = screenshot
        }
      }
    }

    cancel = (reason: CancelReason) => {
      super.cancel?.(reason)
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

    onTestAnnotate = (test: Test, annotation: TestAnnotation): Promise<TestAnnotation> => {
      if (annotation.location) {
        // the file should be the test file
        // tests from other files are not supported
        const map = this.sourceMapCache.get(annotation.location.file)
        if (!map) {
          return rpc().onTaskAnnotate(test.id, annotation)
        }

        const traceMap = new TraceMap(map as any)
        const { line, column, source } = originalPositionFor(traceMap, annotation.location)
        if (line != null && column != null && source != null) {
          let file: string = annotation.location.file
          if (source) {
            const fileUrl = annotation.location.file.startsWith('file://')
              ? annotation.location.file
              : `file://${annotation.location.file}`
            const sourceRootUrl = map.sourceRoot
              ? new URL(map.sourceRoot, fileUrl)
              : fileUrl
            file = new URL(source, sourceRootUrl).pathname
          }

          annotation.location = {
            line,
            column: column + 1,
            // if the file path is on windows, we need to remove the starting slash
            file: file.match(/\/\w:\//) ? file.slice(1) : file,
          }
        }
      }
      return rpc().onTaskAnnotate(test.id, annotation)
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
      try {
        await import(/* @vite-ignore */ importpath)
      }
      catch (err) {
        throw new Error(`Failed to import test file ${filepath}`, { cause: err })
      }
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
    runner.cancel?.(reason)
  })

  const [diffOptions] = await Promise.all([
    loadDiffConfig(config, executor as any),
    loadSnapshotSerializers(config, executor as any),
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

async function getTraceMap(file: string, sourceMaps: Map<string, any>) {
  const result = sourceMaps.get(file) || await rpc().getBrowserFileSourceMap(file).then((map) => {
    sourceMaps.set(file, map)
    return map
  })
  if (!result) {
    return null
  }
  return new TraceMap(result as any)
}

async function updateTestFilesLocations(files: File[], sourceMaps: Map<string, any>) {
  const promises = files.map(async (file) => {
    const traceMap = await getTraceMap(file.filepath, sourceMaps)
    if (!traceMap) {
      return null
    }
    const updateLocation = (task: Task) => {
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
