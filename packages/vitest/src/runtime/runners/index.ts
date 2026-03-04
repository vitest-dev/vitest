import type { VitestRunner, VitestRunnerConstructor } from '@vitest/runner'
import type { Traces } from '../../utils/traces'
import type { SerializedConfig } from '../config'
import type { TestModuleRunner } from '../moduleRunner/testModuleRunner'
import { takeCoverageInsideWorker } from '../../integrations/coverage'
import { rpc } from '../rpc'
import { loadDiffConfig, loadSnapshotSerializers } from '../setup-common'
import { getWorkerState } from '../utils'
import { NodeBenchmarkRunner } from './benchmark'
import { TestRunner } from './test'

async function getTestRunnerConstructor(
  config: SerializedConfig,
  moduleRunner: TestModuleRunner,
): Promise<VitestRunnerConstructor> {
  if (!config.runner) {
    return (
      config.mode === 'test' ? TestRunner : NodeBenchmarkRunner
    ) as any as VitestRunnerConstructor
  }
  const mod = await moduleRunner.import(config.runner)
  if (!mod.default && typeof mod.default !== 'function') {
    throw new Error(
      `Runner must export a default function, but got ${typeof mod.default} imported from ${
        config.runner
      }`,
    )
  }
  return mod.default as VitestRunnerConstructor
}

export async function resolveTestRunner(
  config: SerializedConfig,
  moduleRunner: TestModuleRunner,
  traces: Traces,
): Promise<VitestRunner> {
  const TestRunner = await getTestRunnerConstructor(config, moduleRunner)
  const testRunner = new TestRunner(config)

  // inject private executor to every runner
  Object.defineProperty(testRunner, 'moduleRunner', {
    value: moduleRunner,
    enumerable: false,
    configurable: false,
  })

  if (!testRunner.config) {
    testRunner.config = config
  }

  if (!testRunner.importFile) {
    throw new Error('Runner must implement "importFile" method.')
  }

  if ('__setTraces' in testRunner) {
    (testRunner.__setTraces as any)(traces)
  }

  const [diffOptions] = await Promise.all([
    loadDiffConfig(config, moduleRunner),
    loadSnapshotSerializers(config, moduleRunner),
  ])
  testRunner.config.diffOptions = diffOptions

  // patch some methods, so custom runners don't need to call RPC
  const originalOnTaskUpdate = testRunner.onTaskUpdate
  testRunner.onTaskUpdate = async (task, events) => {
    const p = rpc().onTaskUpdate(task, events)
    await originalOnTaskUpdate?.call(testRunner, task, events)
    return p
  }

  // patch some methods, so custom runners don't need to call RPC
  const originalOnTestAnnotate = testRunner.onTestAnnotate
  testRunner.onTestAnnotate = async (test, annotation) => {
    const p = rpc().onTaskArtifactRecord(test.id, { type: 'internal:annotation', location: annotation.location, annotation })
    const overriddenResult = await originalOnTestAnnotate?.call(testRunner, test, annotation)
    const vitestResult = await p
    return overriddenResult || vitestResult.annotation
  }

  const originalOnTestArtifactRecord = testRunner.onTestArtifactRecord
  testRunner.onTestArtifactRecord = async (test, artifact) => {
    const p = rpc().onTaskArtifactRecord(test.id, artifact)
    const overriddenResult = await originalOnTestArtifactRecord?.call(testRunner, test, artifact)
    const vitestResult = await p
    return overriddenResult as typeof artifact || vitestResult
  }

  const originalOnCollectStart = testRunner.onCollectStart
  testRunner.onCollectStart = async (file) => {
    await rpc().onQueued(file)
    await originalOnCollectStart?.call(testRunner, file)
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

    // Strip function conditions from retry config before sending via RPC
    // Functions cannot be cloned by structured clone algorithm
    const sanitizeRetryConditions = (task: any) => {
      if (task.retry && typeof task.retry === 'object' && typeof task.retry.condition === 'function') {
        // Remove function condition - it can't be serialized
        task.retry = { ...task.retry, condition: undefined }
      }
      if (task.tasks) {
        task.tasks.forEach(sanitizeRetryConditions)
      }
    }
    files.forEach(sanitizeRetryConditions)

    rpc().onCollected(files)
    await originalOnCollected?.call(testRunner, files)
  }

  const originalOnAfterRun = testRunner.onAfterRunFiles
  testRunner.onAfterRunFiles = async (files) => {
    const state = getWorkerState()
    const coverage = await takeCoverageInsideWorker(config.coverage, moduleRunner)

    if (coverage) {
      rpc().onAfterSuiteRun({
        coverage,
        testFiles: files.map(file => file.name).sort(),
        environment: state.environment.viteEnvironment || state.environment.name,
        projectName: state.ctx.projectName,
      })
    }

    await originalOnAfterRun?.call(testRunner, files)
  }

  const originalOnAfterRunTask = testRunner.onAfterRunTask
  testRunner.onAfterRunTask = async (test) => {
    if (config.bail && test.result?.state === 'fail') {
      const previousFailures = await rpc().getCountOfFailedTests()
      const currentFailures = 1 + previousFailures

      if (currentFailures >= config.bail) {
        rpc().onCancel('test-failure')
        testRunner.cancel?.('test-failure')
      }
    }
    await originalOnAfterRunTask?.call(testRunner, test)
  }

  return testRunner
}
