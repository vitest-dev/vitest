import { promises as fs } from 'fs'
import type { BuiltinEnvironment, ResolvedConfig } from '../types'
import { getWorkerState, resetModules } from '../utils'
import { envs } from '../integrations/env'
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
    if (!envs.includes(env))
      throw new Error(`Unsupported environment: "${env}" in ${file}`)
    return {
      file,
      env: env as BuiltinEnvironment,
    }
  }))

  const filesByEnv = filesWithEnv.reduce((acc, { file, env }) => {
    acc[env] ||= []
    acc[env].push(file)
    return acc
  }, {} as Record<BuiltinEnvironment, string[]>)

  for (const env of envs) {
    const environment = env as BuiltinEnvironment
    const files = filesByEnv[environment]

    if (!files || !files.length)
      continue

    await withEnv(environment, config.environmentOptions || {}, async () => {
      for (const file of files) {
        workerState.mockMap.clear()
        resetModules(workerState.moduleCache, true)

        workerState.filepath = file

        await startTests([file], config)

        workerState.filepath = undefined
      }
    })
  }
}
