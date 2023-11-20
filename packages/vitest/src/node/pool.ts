import mm from 'micromatch'
import type { Awaitable } from '@vitest/utils'
import type { BuiltinPool, Pool } from '../types/pool-options'
import type { Vitest } from './core'
import { createChildProcessPool } from './pools/child'
import { createThreadsPool } from './pools/threads'
import { createBrowserPool } from './pools/browser'
import { createVmThreadsPool } from './pools/vm-threads'
import type { WorkspaceProject } from './workspace'
import { createTypecheckPool } from './pools/typecheck'

export type WorkspaceSpec = [project: WorkspaceProject, testFile: string]
export type RunWithFiles = (files: WorkspaceSpec[], invalidates?: string[]) => Awaitable<void>

export interface ProcessPool {
  name: string
  runTests: RunWithFiles
  close?: () => Awaitable<void>
}

export interface PoolProcessOptions {
  workerPath: string
  forksPath: string
  vmPath: string
  execArgv: string[]
  env: Record<string, string>
}

export const builtinPools: BuiltinPool[] = ['forks', 'threads', 'browser', 'vmThreads', 'typescript']

export function createPool(ctx: Vitest): ProcessPool {
  const pools: Record<Pool, ProcessPool | null> = {
    forks: null,
    threads: null,
    browser: null,
    vmThreads: null,
    typescript: null,
  }

  function getDefaultPoolName(project: WorkspaceProject, file: string): Pool {
    if (project.config.browser.enabled)
      return 'browser'

    if (project.config.typecheck.enabled) {
      for (const glob of project.config.typecheck.include) {
        if (mm.isMatch(file, glob, { cwd: project.config.root }))
          return 'typescript'
      }
    }

    return project.config.pool
  }

  function getPoolName([project, file]: WorkspaceSpec) {
    for (const [glob, pool] of project.config.poolMatchGlobs) {
      if ((pool as Pool) === 'browser')
        throw new Error('Since Vitest 0.31.0 "browser" pool is not supported in "poolMatchGlobs". You can create a workspace to run some of your tests in browser in parallel. Read more: https://vitest.dev/guide/workspace')
      if (mm.isMatch(file, glob, { cwd: project.config.root }))
        return pool as Pool
    }
    return getDefaultPoolName(project, file)
  }

  async function runTests(files: WorkspaceSpec[], invalidate?: string[]) {
    const conditions = ctx.server.config.resolve.conditions?.flatMap(c => ['--conditions', c]) || []

    // Instead of passing whole process.execArgv to the workers, pick allowed options.
    // Some options may crash worker, e.g. --prof, --title. nodejs/node#41103
    const execArgv = process.execArgv.filter(execArg =>
      execArg.startsWith('--cpu-prof') || execArg.startsWith('--heap-prof') || execArg.startsWith('--diagnostic-dir'),
    )

    const options: PoolProcessOptions = {
      ...ctx.projectFiles,
      execArgv: [
        ...execArgv,
        ...conditions,
      ],
      env: {
        TEST: 'true',
        VITEST: 'true',
        NODE_ENV: process.env.NODE_ENV || 'test',
        VITEST_MODE: ctx.config.watch ? 'WATCH' : 'RUN',
        ...process.env,
        ...ctx.config.env,
      },
    }

    const customPools = new Map<string, ProcessPool>()
    async function resolveCustomPool(filepath: string) {
      if (customPools.has(filepath))
        return customPools.get(filepath)!
      const pool = await ctx.runner.executeId(filepath)
      if (typeof pool.default !== 'function')
        throw new Error(`Custom pool "${filepath}" must export a function as default export`)
      const poolInstance = await pool.default(ctx, options)
      if (typeof poolInstance?.name !== 'string')
        throw new Error(`Custom pool "${filepath}" should return an object with "name" property`)
      if (typeof poolInstance?.runTests !== 'function')
        throw new Error(`Custom pool "${filepath}" should return an object with "runTests" method`)
      customPools.set(filepath, poolInstance)
      return poolInstance as ProcessPool
    }

    const filesByPool: Record<Pool, WorkspaceSpec[]> = {
      forks: [],
      threads: [],
      browser: [],
      vmThreads: [],
      typescript: [],
    }

    for (const spec of files) {
      const pool = getPoolName(spec)
      filesByPool[pool] ??= []
      filesByPool[pool].push(spec)
    }

    const Sequencer = ctx.config.sequence.sequencer
    const sequencer = new Sequencer(ctx)

    async function sortSpecs(specs: WorkspaceSpec[]) {
      if (ctx.config.shard)
        specs = await sequencer.shard(specs)
      return sequencer.sort(specs)
    }

    await Promise.all(Object.entries(filesByPool).map(async (entry) => {
      const [pool, files] = entry as [Pool, WorkspaceSpec[]]

      if (!files.length)
        return null

      const specs = await sortSpecs(files)

      if (pool === 'browser') {
        pools.browser ??= createBrowserPool(ctx)
        return pools.browser.runTests(specs, invalidate)
      }

      if (pool === 'vmThreads') {
        pools.vmThreads ??= createVmThreadsPool(ctx, options)
        return pools.vmThreads.runTests(specs, invalidate)
      }

      if (pool === 'threads') {
        pools.threads ??= createThreadsPool(ctx, options)
        return pools.threads.runTests(specs, invalidate)
      }

      if (pool === 'typescript') {
        pools.typescript ??= createTypecheckPool(ctx)
        return pools.typescript.runTests(specs)
      }

      if (pool === 'forks') {
        pools.forks ??= createChildProcessPool(ctx, options)
        return pools.forks.runTests(specs, invalidate)
      }

      const poolHandler = await resolveCustomPool(pool)
      pools[poolHandler.name] ??= poolHandler
      return poolHandler.runTests(specs, invalidate)
    }))
  }

  return {
    name: 'default',
    runTests,
    async close() {
      await Promise.all(Object.values(pools).map(p => p?.close?.()))
    },
  }
}
