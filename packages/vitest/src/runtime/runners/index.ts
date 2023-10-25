import type { VitestRunner, VitestRunnerConstructor } from '@vitest/runner'
import { resolve } from 'pathe'
import type { ResolvedConfig } from '../../types/config'
import type { VitestExecutor } from '../execute'
import { distDir } from '../../paths'
import { getWorkerState } from '../../utils/global'
import { rpc } from '../rpc'
import { takeCoverageInsideWorker } from '../../integrations/coverage'
import { loadDiffConfig } from '../setup-common'

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

export async function resolveTestRunner(config: ResolvedConfig, executor: VitestExecutor): Promise<VitestRunner> {
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

  testRunner.config.diffOptions = await loadDiffConfig(config, executor)

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

  const originalOnAfterRun = testRunner.onAfterRunFiles
  testRunner.onAfterRunFiles = async (files) => {
    const state = getWorkerState()
    const coverage = await takeCoverageInsideWorker(config.coverage, executor)
    rpc().onAfterSuiteRun({
      coverage,
      transformMode: state.environment.transformMode,
      projectName: state.ctx.projectName,
    })

    await originalOnAfterRun?.call(testRunner, files)
  }

  const originalOnAfterRunTask = testRunner.onAfterRunTask
  testRunner.onAfterRunTask = async (test) => {
    if (config.bail && test.result?.state === 'fail') {
      const previousFailures = await rpc().getCountOfFailedTests()
      const currentFailures = 1 + previousFailures

      if (currentFailures >= config.bail) {
        rpc().onCancel('test-failure')
        testRunner.onCancel?.('test-failure')
      }
    }
    await originalOnAfterRunTask?.call(testRunner, test)
  }

  return testRunner
}
