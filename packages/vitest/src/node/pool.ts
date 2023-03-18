import { pathToFileURL } from 'node:url'
import mm from 'micromatch'
import { resolve } from 'pathe'
import { distDir, rootDir } from '../constants'
import type { VitestPool } from '../types'
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
  const pools: Record<VitestPool, ProcessPool | null> = {
    child_process: null,
    threads: null,
  }

  function getDefaultPoolName() {
    if (ctx.config.threads)
      return 'threads'
    return 'child_process'
  }

  function getPoolName(file: string) {
    for (const [glob, pool] of ctx.config.poolMatchGlobs || []) {
      if (mm.isMatch(file, glob, { cwd: ctx.server.config.root }))
        return pool
    }
    return getDefaultPoolName()
  }

  async function runTests(files: string[], invalidate?: string[]) {
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

    const filesByPool = {
      child_process: [] as string[],
      threads: [] as string[],
      browser: [] as string[],
    }

    if (!ctx.config.poolMatchGlobs) {
      const name = getDefaultPoolName()
      filesByPool[name] = files
    }
    else {
      for (const file of files) {
        const pool = getPoolName(file)
        filesByPool[pool].push(file)
      }
    }

    await Promise.all(Object.entries(filesByPool).map(([pool, files]) => {
      if (!files.length)
        return null

      if (pool === 'threads') {
        pools.threads ??= createThreadsPool(ctx, options)
        return pools.threads.runTests(files, invalidate)
      }

      pools.child_process ??= createChildProcessPool(ctx, options)
      return pools.child_process.runTests(files, invalidate)
    }))
  }

  return {
    runTests,
    async close() {
      await Promise.all(Object.values(pools).map(p => p?.close()))
    },
  }
}
