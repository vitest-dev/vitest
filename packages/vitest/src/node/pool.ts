import type { Awaitable } from '@vitest/utils'
import type { Vitest } from './core'
import type { TestProject } from './project'
import type { TestSpecification } from './spec'
import type { BuiltinPool, Pool } from './types/pool-options'
import { isatty } from 'node:tty'
import mm from 'micromatch'
import { version as viteVersion } from 'vite'
import { isWindows } from '../utils/env'
import { createForksPool } from './pools/forks'
import { createThreadsPool } from './pools/threads'
import { createTypecheckPool } from './pools/typecheck'
import { createVmForksPool } from './pools/vmForks'
import { createVmThreadsPool } from './pools/vmThreads'

/**
 * @deprecated use TestSpecification instead
 */
export type WorkspaceSpec = TestSpecification & [
  /**
   * @deprecated use spec.project instead
   */
  project: TestProject,
  /**
   * @deprecated use spec.moduleId instead
   */
  file: string,
  /**
   * @deprecated use spec.pool instead
   */
  options: { pool: Pool },
]

export type RunWithFiles = (
  files: TestSpecification[],
  invalidates?: string[]
) => Awaitable<void>

type LocalPool = Exclude<Pool, 'browser'>

export interface ProcessPool {
  name: string
  runTests: RunWithFiles
  collectTests: RunWithFiles
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

function getDefaultPoolName(project: TestProject): Pool {
  if (project.config.browser.enabled) {
    return 'browser'
  }
  return project.config.pool
}

export function getFilePoolName(project: TestProject, file: string) {
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
  return getDefaultPoolName(project)
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
  const viteMajor = Number(viteVersion.split('.')[0])
  const potentialConditions = new Set(viteMajor >= 6
    ? (ctx.vite.config.ssr.resolve?.conditions ?? [])
    : [
        'production',
        'development',
        ...ctx.vite.config.resolve.conditions,
      ])
  const conditions = [...potentialConditions]
    .filter((condition) => {
      if (condition === 'production') {
        return ctx.vite.config.isProduction
      }
      if (condition === 'development') {
        return !ctx.vite.config.isProduction
      }
      return true
    })
    .map((condition) => {
      if (viteMajor >= 6 && condition === 'development|production') {
        return ctx.vite.config.isProduction ? 'production' : 'development'
      }
      return condition
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

  async function executeTests(method: 'runTests' | 'collectTests', files: TestSpecification[], invalidate?: string[]) {
    const options: PoolProcessOptions = {
      execArgv: [...execArgv, ...conditions],
      env: {
        TEST: 'true',
        VITEST: 'true',
        NODE_ENV: process.env.NODE_ENV || 'test',
        VITEST_MODE: ctx.config.watch ? 'WATCH' : 'RUN',
        FORCE_TTY: isatty(1) ? 'true' : '',
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
      if (typeof poolInstance?.[method] !== 'function') {
        throw new TypeError(
          `Custom pool "${filepath}" should return an object with "${method}" method`,
        )
      }

      customPools.set(filepath, poolInstance)
      return poolInstance as ProcessPool
    }

    const filesByPool: Record<LocalPool, TestSpecification[]> = {
      forks: [],
      threads: [],
      vmThreads: [],
      vmForks: [],
      typescript: [],
    }

    const factories: Record<LocalPool, () => ProcessPool> = {
      vmThreads: () => createVmThreadsPool(ctx, options),
      threads: () => createThreadsPool(ctx, options),
      forks: () => createForksPool(ctx, options),
      vmForks: () => createVmForksPool(ctx, options),
      typescript: () => createTypecheckPool(ctx),
    }

    for (const spec of files) {
      const { pool } = spec[2]
      filesByPool[pool] ??= []
      filesByPool[pool].push(spec)
    }

    const Sequencer = ctx.config.sequence.sequencer
    const sequencer = new Sequencer(ctx)

    async function sortSpecs(specs: TestSpecification[]) {
      if (ctx.config.shard) {
        specs = await sequencer.shard(specs)
      }
      return sequencer.sort(specs)
    }

    await Promise.all(
      Object.entries(filesByPool).map(async (entry) => {
        const [pool, files] = entry as [Pool, TestSpecification[]]

        if (!files.length) {
          return null
        }

        const specs = await sortSpecs(files)

        if (pool in factories) {
          const factory = factories[pool]
          pools[pool] ??= factory()
          return pools[pool]![method](specs, invalidate)
        }

        if (pool === 'browser') {
          pools[pool] ??= await (async () => {
            const { createBrowserPool } = await import('@vitest/browser')
            return createBrowserPool(ctx)
          })()
          return pools[pool]![method](specs, invalidate)
        }

        const poolHandler = await resolveCustomPool(pool)
        pools[poolHandler.name] ??= poolHandler
        return poolHandler[method](specs, invalidate)
      }),
    )
  }

  return {
    name: 'default',
    runTests: (files, invalidates) => executeTests('runTests', files, invalidates),
    collectTests: (files, invalidates) => executeTests('collectTests', files, invalidates),
    async close() {
      await Promise.all(Object.values(pools).map(p => p?.close?.()))
    },
  }
}
