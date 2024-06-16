import type { File, Task, TaskResultPack, VitestRunner } from '@vitest/runner'
import type { ResolvedConfig, WorkerGlobalState } from 'vitest'
import type { VitestExecutor } from 'vitest/execute'
import { rpc } from './rpc'
import { importId } from './utils'
import { VitestBrowserSnapshotEnvironment } from './snapshot'
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
          this.onCancel?.('test-failure')
        }
      }
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
          await updateFilesLocations(files)
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
      await import(importpath)
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
  const [
    { VitestTestRunner, NodeBenchmarkRunner },
    { takeCoverageInsideWorker, loadDiffConfig, loadSnapshotSerializers },
  ] = await Promise.all([
    importId('vitest/runners') as Promise<typeof import('vitest/runners')>,
    importId('vitest/browser') as Promise<typeof import('vitest/browser')>,
  ])
  const runnerClass
    = config.mode === 'test' ? VitestTestRunner : NodeBenchmarkRunner
  const BrowserRunner = createBrowserRunner(runnerClass, mocker, state, {
    takeCoverage: () =>
      takeCoverageInsideWorker(config.coverage, { executeId: importId }),
  })
  if (!config.snapshotOptions.snapshotEnvironment) {
    config.snapshotOptions.snapshotEnvironment
      = new VitestBrowserSnapshotEnvironment()
  }
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

async function updateFilesLocations(files: File[]) {
  const { loadSourceMapUtils } = (await importId(
    'vitest/utils',
  )) as typeof import('vitest/utils')
  const { TraceMap, originalPositionFor } = await loadSourceMapUtils()

  const promises = files.map(async (file) => {
    const result = await rpc().getBrowserFileSourceMap(file.filepath)
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
