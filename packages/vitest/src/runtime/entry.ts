import { promises as fs } from 'fs'
import type { BuiltinEnvironment, ResolvedConfig } from '../types'
import { getWorkerState, resetModules } from '../utils'
import { setupGlobalEnv, withEnv } from './setup'
import { startTests } from './run'

export async function run(files: string[], config: ResolvedConfig): Promise<void> {
  await setupGlobalEnv(config)

  const workerState = getWorkerState()

  for (const file of files) {
    workerState.mockMap.clear()
    resetModules()

    const code = await fs.readFile(file, 'utf-8')

    const env = code.match(/@(?:vitest|jest)-environment\s+?([\w-]+)\b/)?.[1] || config.environment || 'node'

    if (!['node', 'jsdom', 'happy-dom'].includes(env))
      throw new Error(`Unsupported environment: ${env}`)

    workerState.filepath = file

    await withEnv(env as BuiltinEnvironment, config.environmentOptions || {}, async() => {
      await startTests([file], config)
    })

    workerState.filepath = undefined
  }
}
