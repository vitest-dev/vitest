import type { ExecuteOptions } from 'vitest/node'
import type { ResolvedConfig } from '../types'
import { VitestExecutor } from './executors/vitest'
import { VitestNodeStrictExecutor } from './executors/node-strict'

export async function createVitestExecutor(config: ResolvedConfig, options: Pick<ExecuteOptions, 'mockMap' | 'moduleCache'>) {
  const Executor = config.environment === 'node-strict' ? VitestNodeStrictExecutor : VitestExecutor

  const runner = new Executor(config, {
    moduleCache: options.moduleCache,
    mockMap: options.mockMap,
  })

  await runner.executeId('/@vite/env')

  return runner
}
