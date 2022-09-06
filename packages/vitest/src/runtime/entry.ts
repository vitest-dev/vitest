import { promises as fs } from 'fs'
import type { EnvironmentOptions, ResolvedConfig, VitestEnvironment } from '../types'
import { getWorkerState, resetModules } from '../utils'
import { setupGlobalEnv, withEnv } from './setup'
import { startTests } from './run'

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
      envOptions: envOptions as EnvironmentOptions | undefined,
    }
  }))

  for (const { file, env, envOptions } of filesWithEnv) {
    await withEnv(env, envOptions || config.environmentOptions, async () => {
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
    })
  }
}
