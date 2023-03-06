import { pathToFileURL } from 'node:url'
import { resolve } from 'pathe'
import { distDir, rootDir } from '../constants'
import type { Vitest } from './core'
import { createChildProcessPool } from './pools/child'
import { createThreadsPool } from './pools/threads'

export type RunWithFiles = (files: string[], invalidates?: string[]) => Promise<void>

export interface ProcessPool {
  runTests: RunWithFiles
  close: () => Promise<void>
}

export interface PoolProcessOptions {
  execArgv: string[]
  env: Record<string, string>
}

const loaderPath = pathToFileURL(resolve(distDir, './loader.js')).href
const suppressLoaderWarningsPath = resolve(rootDir, './suppress-warnings.cjs')

export function createPool(ctx: Vitest): ProcessPool {
  const conditions = ctx.server.config.resolve.conditions?.flatMap(c => ['--conditions', c]) || []

  // Instead of passing whole process.execArgv to the workers, pick allowed options.
  // Some options may crash worker, e.g. --prof, --title. nodejs/node#41103
  const execArgv = process.execArgv.filter(execArg =>
    execArg.startsWith('--cpu-prof') || execArg.startsWith('--heap-prof'),
  )

  const options: PoolProcessOptions = {
    execArgv: ctx.config.deps.registerNodeLoader
      ? [
          ...execArgv,
          '--require',
          suppressLoaderWarningsPath,
          '--experimental-loader',
          loaderPath,
        ]
      : [
          ...execArgv,
          ...conditions,
        ],
    env: {
      TEST: 'true',
      VITEST: 'true',
      NODE_ENV: ctx.config.mode || 'test',
      VITEST_MODE: ctx.config.watch ? 'WATCH' : 'RUN',
      ...process.env,
      ...ctx.config.env,
    },
  }

  if (!ctx.config.threads)
    return createChildProcessPool(ctx, options)
  return createThreadsPool(ctx, options)
}
