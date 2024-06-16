import mm from 'micromatch'
import type { Awaitable } from '@vitest/utils'
import type { BuiltinPool, Pool } from '../types/pool-options'
import { isWindows } from '../utils/env'
import type { Vitest } from './core'
import { createForksPool } from './pools/forks'
import { createThreadsPool } from './pools/threads'
import { createBrowserPool } from './pools/browser'
import { createVmThreadsPool } from './pools/vmThreads'
import type { WorkspaceProject } from './workspace'
import { createTypecheckPool } from './pools/typecheck'
import { createVmForksPool } from './pools/vmForks'

export type WorkspaceSpec = [project: WorkspaceProject, testFile: string]
export type RunWithFiles = (
  files: WorkspaceSpec[],
  invalidates?: string[]
) => Awaitable<void>

export interface ProcessPool {
  name: string
  runTests: RunWithFiles
  close?: () => Awaitable<void>
}

export interface PoolProcessOptions {
  execArgv: string[]
  env: Record<string, string>
}

export const builtinPools: BuiltinPool[] = [
  'forks',
  'threads',
  'browser',
  'vmThreads',
  'vmForks',
  'typescript',
]

function getDefaultPoolName(project: WorkspaceProject, file: string): Pool {
  if (project.config.typecheck.enabled) {
    for (const glob of project.config.typecheck.include) {
      if (mm.isMatch(file, glob, { cwd: project.config.root })) {
        return 'typescript'
      }
    }
  }
  if (project.config.browser.enabled) {
    return 'browser'
  }
  return project.config.pool
}

export function getFilePoolName(project: WorkspaceProject, file: string) {
  for (const [glob, pool] of project.config.poolMatchGlobs) {
    if ((pool as Pool) === 'browser') {
      throw new Error(
        'Since Vitest 0.31.0 "browser" pool is not supported in "poolMatchGlobs". You can create a workspace to run some of your tests in browser in parallel. Read more: https://vitest.dev/guide/workspace',
      )
    }
    if (mm.isMatch(file, glob, { cwd: project.config.root })) {
      return pool as Pool
    }
  }
  return getDefaultPoolName(project, file)
}

export function createPool(ctx: Vitest): ProcessPool {
  const pools: Record<Pool, ProcessPool | null> = {
    forks: null,
    threads: null,
    browser: null,
    vmThreads: null,
    vmForks: null,
    typescript: null,
  }

  // in addition to resolve.conditions Vite also adds production/development,
  // see: https://github.com/vitejs/vite/blob/af2aa09575229462635b7cbb6d248ca853057ba2/packages/vite/src/node/plugins/resolve.ts#L1056-L1080
  const potentialConditions = new Set([
    'production',
    'development',
    ...ctx.server.config.resolve.conditions,
  ])
  const conditions = [...potentialConditions]
    .filter((condition) => {
      if (condition === 'production') {
        return ctx.server.config.isProduction
      }
      if (condition === 'development') {
        return !ctx.server.config.isProduction
      }
      return true
    })
    .flatMap(c => ['--conditions', c])

  // Instead of passing whole process.execArgv to the workers, pick allowed options.
  // Some options may crash worker, e.g. --prof, --title. nodejs/node#41103
  const execArgv = process.execArgv.filter(
    execArg =>
      execArg.startsWith('--cpu-prof')
      || execArg.startsWith('--heap-prof')
      || execArg.startsWith('--diagnostic-dir'),
  )

  async function runTests(files: WorkspaceSpec[], invalidate?: string[]) {
    const options: PoolProcessOptions = {
      execArgv: [...execArgv, ...conditions],
      env: {
        TEST: 'true',
        VITEST: 'true',
        NODE_ENV: process.env.NODE_ENV || 'test',
        VITEST_MODE: ctx.config.watch ? 'WATCH' : 'RUN',
        ...process.env,
        ...ctx.config.env,
      },
    }

    // env are case-insensitive on Windows, but spawned processes don't support it
    if (isWindows) {
      for (const name in options.env) {
        options.env[name.toUpperCase()] = options.env[name]
      }
    }

    const customPools = new Map<string, ProcessPool>()
    async function resolveCustomPool(filepath: string) {
      if (customPools.has(filepath)) {
        return customPools.get(filepath)!
      }

      const pool = await ctx.runner.executeId(filepath)
      if (typeof pool.default !== 'function') {
        throw new TypeError(
          `Custom pool "${filepath}" must export a function as default export`,
        )
      }

      const poolInstance = await pool.default(ctx, options)

      if (typeof poolInstance?.name !== 'string') {
        throw new TypeError(
          `Custom pool "${filepath}" should return an object with "name" property`,
        )
      }
      if (typeof poolInstance?.runTests !== 'function') {
        throw new TypeError(
          `Custom pool "${filepath}" should return an object with "runTests" method`,
        )
      }

      customPools.set(filepath, poolInstance)
      return poolInstance as ProcessPool
    }

    const filesByPool: Record<Pool, WorkspaceSpec[]> = {
      forks: [],
      threads: [],
      browser: [],
      vmThreads: [],
      vmForks: [],
      typescript: [],
    }

    const factories: Record<Pool, () => ProcessPool> = {
      browser: () => createBrowserPool(ctx),
      vmThreads: () => createVmThreadsPool(ctx, options),
      threads: () => createThreadsPool(ctx, options),
      forks: () => createForksPool(ctx, options),
      vmForks: () => createVmForksPool(ctx, options),
      typescript: () => createTypecheckPool(ctx),
    }

    for (const spec of files) {
      const pool = getFilePoolName(spec[0], spec[1])
      filesByPool[pool] ??= []
      filesByPool[pool].push(spec)
    }

    const Sequencer = ctx.config.sequence.sequencer
    const sequencer = new Sequencer(ctx)

    async function sortSpecs(specs: WorkspaceSpec[]) {
      if (ctx.config.shard) {
        specs = await sequencer.shard(specs)
      }
      return sequencer.sort(specs)
    }

    await Promise.all(
      Object.entries(filesByPool).map(async (entry) => {
        const [pool, files] = entry as [Pool, WorkspaceSpec[]]

        if (!files.length) {
          return null
        }

        const specs = await sortSpecs(files)

        if (pool in factories) {
          const factory = factories[pool]
          pools[pool] ??= factory()
          return pools[pool]!.runTests(specs, invalidate)
        }

        const poolHandler = await resolveCustomPool(pool)
        pools[poolHandler.name] ??= poolHandler
        return poolHandler.runTests(specs, invalidate)
      }),
    )
  }

  return {
    name: 'default',
    runTests,
    async close() {
      await Promise.all(Object.values(pools).map(p => p?.close?.()))
    },
  }
}
