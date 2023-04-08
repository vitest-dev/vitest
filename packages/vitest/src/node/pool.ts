import { pathToFileURL } from 'node:url'
import mm from 'micromatch'
import { resolve } from 'pathe'
import { distDir, rootDir } from '../paths'
import type { VitestPool } from '../types'
import type { Vitest } from './core'
import { createChildProcessPool } from './pools/child'
import { createThreadsPool } from './pools/threads'
import { createBrowserPool } from './pools/browser'
import type { VitestWorkspace } from './workspace'

export type WorkspaceSpec = [VitestWorkspace, string]
export type RunWithFiles = (files: WorkspaceSpec[], invalidates?: string[]) => Promise<void>

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
    browser: null,
  }

  function getDefaultPoolName(workspace: VitestWorkspace) {
    if (workspace.config.browser.enabled)
      return 'browser'
    if (workspace.config.threads)
      return 'threads'
    return 'child_process'
  }

  function getPoolName([workspace, file]: WorkspaceSpec) {
    for (const [glob, pool] of workspace.config.poolMatchGlobs || []) {
      if (mm.isMatch(file, glob, { cwd: ctx.server.config.root }))
        return pool
    }
    return getDefaultPoolName(workspace)
  }

  async function runTests(files: WorkspaceSpec[], invalidate?: string[]) {
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
      child_process: [] as WorkspaceSpec[],
      threads: [] as WorkspaceSpec[],
      browser: [] as WorkspaceSpec[],
    }

    for (const spec of files) {
      const pool = getPoolName(spec)
      filesByPool[pool].push(spec)
    }

    await Promise.all(Object.entries(filesByPool).map(([pool, files]) => {
      if (!files.length)
        return null

      if (pool === 'browser') {
        pools.browser ??= createBrowserPool(ctx)
        return pools.browser.runTests(files, invalidate)
      }

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
