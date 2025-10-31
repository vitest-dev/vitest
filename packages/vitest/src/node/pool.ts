import type { Awaitable } from '@vitest/utils'
import type { Vitest } from './core'
import type { PoolTask } from './pools/types'
import type { TestProject } from './project'
import type { TestSpecification } from './spec'
import type { BuiltinPool, ResolvedConfig } from './types/config'
import * as nodeos from 'node:os'
import { isatty } from 'node:tty'
import { resolve } from 'pathe'
import { version as viteVersion } from 'vite'
import { rootDir } from '../paths'
import { isWindows } from '../utils/env'
import { getWorkerMemoryLimit, stringToBytes } from '../utils/memory-limit'
import { createBrowserPool } from './pools/browser'
import { Pool } from './pools/pool'

const suppressWarningsPath = resolve(rootDir, './suppress-warnings.cjs')

type RunWithFiles = (
  files: TestSpecification[],
  invalidates?: string[]
) => Promise<void>

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

export function getFilePoolName(project: TestProject): ResolvedConfig['pool'] {
  if (project.config.browser.enabled) {
    return 'browser'
  }
  return project.config.pool
}

export function createPool(ctx: Vitest): ProcessPool {
  const pool = new Pool({
    distPath: ctx.distPath,
    teardownTimeout: ctx.config.teardownTimeout,
    state: ctx.state,
  }, ctx.logger)

  const options = resolveOptions(ctx)

  const Sequencer = ctx.config.sequence.sequencer
  const sequencer = new Sequencer(ctx)

  let browserPool: ProcessPool | undefined

  async function executeTests(method: 'run' | 'collect', specs: TestSpecification[], invalidates?: string[]): Promise<void> {
    ctx.onCancel(() => pool.cancel())

    if (ctx.config.shard) {
      if (!ctx.config.passWithNoTests && ctx.config.shard.count > specs.length) {
        throw new Error(
          '--shard <count> must be a smaller than count of test files. '
          + `Resolved ${specs.length} test files for --shard=${ctx.config.shard.index}/${ctx.config.shard.count}.`,
        )
      }
      specs = await sequencer.shard(Array.from(specs))
    }

    // 1) Sort using sequencer
    const sorted = await sequencer.sort(specs)

    // 2) Resolve environments for all sorted specs
    const environments = await ctx._getSpecificationsEnvironments(sorted)

    // 3) Build tasks and collect browser specs
    const projectEnvs = new WeakMap<TestProject, Partial<NodeJS.ProcessEnv>>()
    const projectExecArgvs = new WeakMap<TestProject, string[]>()

    const tasks: PoolTask[] = []
    const browserSpecs: TestSpecification[] = []
    let workerId = 0

    for (const spec of sorted) {
      const { project, pool: worker } = spec
      if (worker === 'browser') {
        browserSpecs.push(spec)
        continue
      }

      const environment = environments.get(spec)!
      if (!environment) {
        throw new Error(`Cannot find the environment. This is a bug in Vitest.`)
      }

      let env = projectEnvs.get(project)
      if (!env) {
        env = {
          ...process.env,
          ...options.env,
          ...ctx.config.env,
          ...project.config.env,
        }
        if (isWindows) {
          for (const name in env) {
            env[name.toUpperCase()] = env[name]
          }
        }
        projectEnvs.set(project, env)
      }

      let execArgv = projectExecArgvs.get(project)
      if (!execArgv) {
        execArgv = [
          ...options.execArgv,
          ...project.config.execArgv,
        ]
        projectExecArgvs.set(project, execArgv)
      }

      tasks.push({
        context: {
          pool: worker,
          config: project.serializedConfig,
          files: [{ filepath: spec.moduleId, testLocations: spec.testLines }],
          invalidates,
          environment,
          projectName: project.name,
          providedContext: project.getProvidedContext(),
          workerId: workerId++,
        },
        project,
        env,
        execArgv,
        worker,
        isolate: project.config.isolate,
        memoryLimit: getMemoryLimit(ctx.config, worker) ?? null,
      })
    }

    // 4) Determine a single global maxWorkers and run all tasks through the pool
    const globalMaxWorkers = tasks.length
      ? Math.max(...tasks.map(t => resolveMaxWorkers(t.project)))
      : 1
    pool.setMaxWorkers(globalMaxWorkers)

    const results: PromiseSettledResult<void>[] = []

    const promises = tasks.map(async (task) => {
      if (ctx.isCancelling) {
        return ctx.state.cancelFiles(task.context.files, task.project)
      }

      try {
        await pool.run(task, method)
      }
      catch (error) {
        if (ctx.isCancelling && error instanceof Error && error.message === 'Cancelled') {
          ctx.state.cancelFiles(task.context.files, task.project)
        }
        else {
          throw error
        }
      }
    })

    if (browserSpecs.length) {
      browserPool ??= createBrowserPool(ctx)
      if (method === 'collect') {
        promises.push(browserPool.collectTests(browserSpecs))
      }
      else {
        promises.push(browserPool.runTests(browserSpecs))
      }
    }

    const groupResults = await Promise.allSettled(promises)
    results.push(...groupResults)

    const errors = results
      .filter(result => result.status === 'rejected')
      .map(result => result.reason)

    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        'Errors occurred while running tests. For more information, see serialized error.',
      )
    }
  }

  return {
    name: 'default',
    runTests: (files, invalidates) => executeTests('run', files, invalidates),
    collectTests: (files, invalidates) => executeTests('collect', files, invalidates),
    async close() {
      await Promise.all([pool.close(), browserPool?.close?.()])
    },
  }
}

function resolveOptions(ctx: Vitest) {
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

  const options: PoolProcessOptions = {
    execArgv: [
      ...execArgv,
      ...conditions,
      '--experimental-import-meta-resolve',
      '--require',
      suppressWarningsPath,
    ],
    env: {
      TEST: 'true',
      VITEST: 'true',
      NODE_ENV: process.env.NODE_ENV || 'test',
      VITEST_MODE: ctx.config.watch ? 'WATCH' : 'RUN',
      FORCE_TTY: isatty(1) ? 'true' : '',
    },
  }

  return options
}

function resolveMaxWorkers(project: TestProject) {
  if (project.config.maxWorkers) {
    return project.config.maxWorkers
  }

  if (project.vitest.config.maxWorkers) {
    return project.vitest.config.maxWorkers
  }

  const numCpus = typeof nodeos.availableParallelism === 'function'
    ? nodeos.availableParallelism()
    : nodeos.cpus().length

  if (project.vitest.config.watch) {
    return Math.max(Math.floor(numCpus / 2), 1)
  }

  return Math.max(numCpus - 1, 1)
}

function getMemoryLimit(config: ResolvedConfig, pool: string) {
  if (pool !== 'vmForks' && pool !== 'vmThreads') {
    return null
  }

  const memory = nodeos.totalmem()
  const limit = getWorkerMemoryLimit(config)

  if (typeof memory === 'number') {
    return stringToBytes(limit, config.watch ? memory / 2 : memory)
  }

  // If totalmem is not supported we cannot resolve percentage based values like 0.5, "50%"
  if (
    (typeof limit === 'number' && limit > 1)
    || (typeof limit === 'string' && limit.at(-1) !== '%')
  ) {
    return stringToBytes(limit)
  }

  // just ignore "memoryLimit" value because we cannot detect memory limit
  return null
}
