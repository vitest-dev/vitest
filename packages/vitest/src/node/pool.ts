import mm from 'micromatch'
import type { Pool } from '../types'
import type { Vitest } from './core'
import { createChildProcessPool } from './pools/child'
import { createThreadsPool } from './pools/threads'
import { createBrowserPool } from './pools/browser'
import { createVmThreadsPool } from './pools/vm-threads'
import type { WorkspaceProject } from './workspace'
import { createTypecheckPool } from './pools/typecheck'

export type WorkspaceSpec = [project: WorkspaceProject, testFile: string]
export type RunWithFiles = (files: WorkspaceSpec[], invalidates?: string[]) => Promise<void>

export interface ProcessPool {
  runTests: RunWithFiles
  close: () => Promise<void>
}

export interface PoolProcessOptions {
  workerPath: string
  forksPath: string
  vmPath: string
  execArgv: string[]
  env: Record<string, string>
}

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
    for (const [glob, pool] of project.config.poolMatchGlobs || []) {
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

    const filesByPool: Record<Pool, WorkspaceSpec[]> = {
      forks: [],
      threads: [],
      browser: [],
      vmThreads: [],
      typescript: [],
    }

    for (const spec of files) {
      const pool = getPoolName(spec)
      if (!(pool in filesByPool))
        throw new Error(`Unknown pool name "${pool}" for ${spec[1]}. Available pools: ${Object.keys(filesByPool).join(', ')}`)
      filesByPool[pool].push(spec)
    }

    await Promise.all(Object.entries(filesByPool).map((entry) => {
      const [pool, files] = entry as [Pool, WorkspaceSpec[]]

      if (!files.length)
        return null

      if (pool === 'browser') {
        pools.browser ??= createBrowserPool(ctx)
        return pools.browser.runTests(files, invalidate)
      }

      if (pool === 'vmThreads') {
        pools.vmThreads ??= createVmThreadsPool(ctx, options)
        return pools.vmThreads.runTests(files, invalidate)
      }

      if (pool === 'threads') {
        pools.threads ??= createThreadsPool(ctx, options)
        return pools.threads.runTests(files, invalidate)
      }

      if (pool === 'typescript') {
        pools.typescript ??= createTypecheckPool(ctx)
        return pools.typescript.runTests(files)
      }

      pools.forks ??= createChildProcessPool(ctx, options)
      return pools.forks.runTests(files, invalidate)
    }))
  }

  return {
    runTests,
    async close() {
      await Promise.all(Object.values(pools).map(p => p?.close()))
    },
  }
}
