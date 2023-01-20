import { promises as fs } from 'node:fs'
import mm from 'micromatch'
import { startTests } from '@vitest/runner'
import type { EnvironmentOptions, ResolvedConfig, VitestEnvironment } from '../types'
import { getWorkerState, resetModules } from '../utils'
import { vi } from '../integrations/vi'
import { envs } from '../integrations/env'
import { setupGlobalEnv, withEnv } from './setup'
import { NodeTestRunner } from './runners/node'
import { NodeBenchmarkRunner } from './runners/benchmark'

function groupBy<T, K extends string | number | symbol>(collection: T[], iteratee: (item: T) => K) {
  return collection.reduce((acc, item) => {
    const key = iteratee(item)
    acc[key] ||= []
    acc[key].push(item)
    return acc
  }, {} as Record<K, T[]>)
}

// browser shouldn't call this!
export async function run(files: string[], config: ResolvedConfig): Promise<void> {
  await setupGlobalEnv(config)

  const workerState = getWorkerState()

  // TODO: allow custom runners?
  const testRunner = config.mode === 'test'
    ? new NodeTestRunner(config)
    : new NodeBenchmarkRunner(config)

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

      await withEnv(environment, files[0].envOptions || config.environmentOptions || {}, async () => {
        for (const { file } of files) {
          // it doesn't matter if running with --threads
          // if running with --no-threads, we usually want to reset everything before running a test
          // but we have --isolate option to disable this
          if (config.isolate) {
            workerState.mockMap.clear()
            resetModules(workerState.moduleCache, true)
          }

          workerState.filepath = file

          await startTests([file], testRunner)

          workerState.filepath = undefined

          // reset after tests, because user might call `vi.setConfig` in setupFile
          vi.resetConfig()
        }
      })
    }
  }
}
