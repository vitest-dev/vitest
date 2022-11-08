import { promises as fs } from 'fs'
import type { EnvironmentOptions, ResolvedConfig, VitestEnvironment } from '../types'
import { getWorkerState, resetModules } from '../utils'
import { vi } from '../integrations/vi'
import { envs } from '../integrations/env'
import { setupGlobalEnv, withEnv } from './setup'
import { startTests } from './run'

function groupBy<T, K extends string | number | symbol >(collection: T[], iteratee: (item: T) => K) {
  return collection.reduce((acc, item) => {
    const key = iteratee(item)
    acc[key] ||= []
    acc[key].push(item)
    return acc
  }, {} as Record<K, T[]>)
}

export async function run(files: string[], config: ResolvedConfig): Promise<void> {
  await setupGlobalEnv(config)

  const workerState = getWorkerState()

  // TODO @web-runner: we need to figure out how to do this on the browser
  if (config.browser) {
    workerState.mockMap.clear()
    await startTests(files, config)
    return
  }

  // if calling from a worker, there will always be one file
  // if calling with no-threads, this will be the whole suite
  const filesWithEnv = await Promise.all(files.map(async (file) => {
    const code = await fs.readFile(file, 'utf-8')
    const env = code.match(/@(?:vitest|jest)-environment\s+?([\w-]+)\b/)?.[1] || config.environment || 'node'
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

          await startTests([file], config)

          workerState.filepath = undefined

          // reset after tests, because user might call `vi.setConfig` in setupFile
          vi.resetConfig()
        }
      })
    }
  }
}
