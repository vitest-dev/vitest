import { performance } from 'node:perf_hooks'
import type { VitestRunner, VitestRunnerConstructor } from '@vitest/runner'
import { startTests } from '@vitest/runner'
import { resolve } from 'pathe'
import type { ContextTestEnvironment, ResolvedConfig } from '../types'
import { getWorkerState, resetModules } from '../utils'
import { vi } from '../integrations/vi'
import { distDir } from '../paths'
import { startCoverageInsideWorker, stopCoverageInsideWorker, takeCoverageInsideWorker } from '../integrations/coverage'
import { setupChaiConfig } from '../integrations/chai'
import { setupGlobalEnv, withEnv } from './setup.node'
import { rpc } from './rpc'
import type { VitestExecutor } from './execute'

const runnersFile = resolve(distDir, 'runners.js')

async function getTestRunnerConstructor(config: ResolvedConfig, executor: VitestExecutor): Promise<VitestRunnerConstructor> {
  if (!config.runner) {
    const { VitestTestRunner, NodeBenchmarkRunner } = await executor.executeFile(runnersFile)
    return (config.mode === 'test' ? VitestTestRunner : NodeBenchmarkRunner) as VitestRunnerConstructor
  }
  const mod = await executor.executeId(config.runner)
  if (!mod.default && typeof mod.default !== 'function')
    throw new Error(`Runner must export a default function, but got ${typeof mod.default} imported from ${config.runner}`)
  return mod.default as VitestRunnerConstructor
}

async function getTestRunner(config: ResolvedConfig, executor: VitestExecutor): Promise<VitestRunner> {
  const TestRunner = await getTestRunnerConstructor(config, executor)
  const testRunner = new TestRunner(config)

  // inject private executor to every runner
  Object.defineProperty(testRunner, '__vitest_executor', {
    value: executor,
    enumerable: false,
    configurable: false,
  })

  if (!testRunner.config)
    testRunner.config = config

  if (!testRunner.importFile)
    throw new Error('Runner must implement "importFile" method.')

  // patch some methods, so custom runners don't need to call RPC
  const originalOnTaskUpdate = testRunner.onTaskUpdate
  testRunner.onTaskUpdate = async (task) => {
    const p = rpc().onTaskUpdate(task)
    await originalOnTaskUpdate?.call(testRunner, task)
    return p
  }

  const originalOnCollected = testRunner.onCollected
  testRunner.onCollected = async (files) => {
    const state = getWorkerState()
    files.forEach((file) => {
      file.prepareDuration = state.durations.prepare
      file.environmentLoad = state.durations.environment
      // should be collected only for a single test file in a batch
      state.durations.prepare = 0
      state.durations.environment = 0
    })
    rpc().onCollected(files)
    await originalOnCollected?.call(testRunner, files)
  }

  const originalOnAfterRun = testRunner.onAfterRun
  testRunner.onAfterRun = async (files) => {
    const coverage = await takeCoverageInsideWorker(config.coverage, executor)
    rpc().onAfterSuiteRun({ coverage })
    await originalOnAfterRun?.call(testRunner, files)
  }

  return testRunner
}

// browser shouldn't call this!
export async function run(files: string[], config: ResolvedConfig, environment: ContextTestEnvironment, executor: VitestExecutor): Promise<void> {
  const workerState = getWorkerState()

  await setupGlobalEnv(config)
  await startCoverageInsideWorker(config.coverage, executor)

  if (config.chaiConfig)
    setupChaiConfig(config.chaiConfig)

  const runner = await getTestRunner(config, executor)
  workerState.onCancel.then(reason => runner.onCancel?.(reason))

  workerState.durations.prepare = performance.now() - workerState.durations.prepare

  // @ts-expect-error untyped global
  globalThis.__vitest_environment__ = environment

  workerState.durations.environment = performance.now()

  await withEnv(environment.name, environment.options || config.environmentOptions || {}, executor, async () => {
    workerState.durations.environment = performance.now() - workerState.durations.environment

    for (const file of files) {
      // it doesn't matter if running with --threads
      // if running with --no-threads, we usually want to reset everything before running a test
      // but we have --isolate option to disable this
      if (config.isolate) {
        workerState.mockMap.clear()
        resetModules(workerState.moduleCache, true)
      }

      workerState.filepath = file

      await startTests([file], runner)

      workerState.filepath = undefined

      // reset after tests, because user might call `vi.setConfig` in setupFile
      vi.resetConfig()
      // mocks should not affect different files
      vi.restoreAllMocks()
    }

    await stopCoverageInsideWorker(config.coverage, executor)
  })

  workerState.environmentTeardownRun = true
}
