import { promises as fs } from 'node:fs'
import mm from 'micromatch'
import type { VitestRunner, VitestRunnerConstructor } from '@vitest/runner'
import { startTests } from '@vitest/runner'
import { resolve } from 'pathe'
import type { EnvironmentOptions, ResolvedConfig, VitestEnvironment } from '../types'
import { getWorkerState, resetModules } from '../utils'
import { vi } from '../integrations/vi'
import { envs } from '../integrations/env'
import { takeCoverageInsideWorker } from '../integrations/coverage'
import { distDir } from '../constants'
import { setupGlobalEnv, withEnv } from './setup.node'
import { rpc } from './rpc'
import type { VitestExecutor } from './execute'

const runnersFile = resolve(distDir, 'runners.js')

function groupBy<T, K extends string | number | symbol>(collection: T[], iteratee: (item: T) => K) {
  return collection.reduce((acc, item) => {
    const key = iteratee(item)
    acc[key] ||= []
    acc[key].push(item)
    return acc
  }, {} as Record<K, T[]>)
}

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
export async function run(files: string[], config: ResolvedConfig, executor: VitestExecutor): Promise<void> {
  await setupGlobalEnv(config)

  const workerState = getWorkerState()

  const runner = await getTestRunner(config, executor)

  // if calling from a worker, there will always be one file
  // if calling with no-threads, this will be the whole suite
  const filesWithEnv = await Promise.all(files.map(async (file) => {
    const code = await fs.readFile(file, 'utf-8')

    // 1. Check for control comments in the file
    let env = code.match(/@(?:vitest|jest)-environment\s+?([\w-]+)\b/)?.[1]
    // 2. Check for globals
    if (!env) {
      for (const [glob, target] of config.environmentMatchGlobs || []) {
        if (mm.isMatch(file, glob)) {
          env = target
          break
        }
      }
    }
    // 3. Fallback to global env
    env ||= config.environment || 'node'

    const envOptions = JSON.parse(code.match(/@(?:vitest|jest)-environment-options\s+?(.+)/)?.[1] || 'null')
    return {
      file,
      env: env as VitestEnvironment,
      envOptions: envOptions ? { [env]: envOptions } as EnvironmentOptions : null,
    }
  }))

  const filesByEnv = groupBy(filesWithEnv, ({ env }) => env)

  const orderedEnvs = envs.concat(
    Object.keys(filesByEnv).filter(env => !envs.includes(env)),
  )

  for (const env of orderedEnvs) {
    const environment = env as VitestEnvironment
    const files = filesByEnv[environment]

    if (!files || !files.length)
      continue

    // @ts-expect-error untyped global
    globalThis.__vitest_environment__ = environment

    const filesByOptions = groupBy(files, ({ envOptions }) => JSON.stringify(envOptions))

    for (const options of Object.keys(filesByOptions)) {
      const files = filesByOptions[options]

      if (!files || !files.length)
        continue

      await withEnv(environment, files[0].envOptions || config.environmentOptions || {}, executor, async () => {
        for (const { file } of files) {
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
      })
    }
  }
}
