import type { Awaitable } from '@vitest/utils'
import type { ContextTestEnvironment } from '../types/worker'
import type { Vitest } from './core'
import type { PoolTask } from './pools/types'
import type { TestProject } from './project'
import type { TestSequencer } from './sequencers/types'
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

    const sorted = await sequencer.sort(specs)
    const environments = await ctx._getSpecificationsEnvironments(sorted)
    const { parallelTests, sequentialTests, browserTests } = await groupSpecifications(
      specs,
      environments,
      sequencer,
    )

    const projectEnvs = new WeakMap<TestProject, Partial<NodeJS.ProcessEnv>>()
    const projectExecArgvs = new WeakMap<TestProject, string[]>()

    function getEnv(project: TestProject) {
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
      return env
    }

    function getExecArg(project: TestProject) {
      let execArgv = projectExecArgvs.get(project)
      if (!execArgv) {
        execArgv = [...options.execArgv, ...project.config.execArgv]
        projectExecArgvs.set(project, execArgv)
      }
      return execArgv
    }

    let workerId = 0

    function createTask(specifications: TestSpecification[]): PoolTask {
      const { project, pool } = specifications[0]
      const environment = environments.get(specifications[0])!

      return {
        context: {
          pool,
          config: project.serializedConfig,
          files: specifications.map(s => ({ filepath: s.moduleId, testLocations: s.testLines })),
          invalidates,
          environment,
          projectName: project.name,
          providedContext: project.getProvidedContext(),
          workerId: workerId++,
        },
        project,
        env: getEnv(project),
        execArgv: getExecArg(project),
        worker: pool,
        isolate: project.config.isolate,
        memoryLimit: getMemoryLimit(ctx.config, pool) ?? null,
      }
    }

    const tasks = [
      ...parallelTests.map(specification => createTask([specification])),
      ...sequentialTests.map(specifications => createTask(specifications)),
    ]

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

    if (browserTests.length) {
      browserPool ??= createBrowserPool(ctx)
      if (method === 'collect') {
        promises.push(browserPool.collectTests(browserTests))
      }
      else {
        promises.push(browserPool.runTests(browserTests))
      }
    }

    results.push(...await Promise.allSettled(promises))

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

async function groupSpecifications(
  specifications: TestSpecification[],
  environments: WeakMap<TestSpecification, ContextTestEnvironment>,
  sequencer: TestSequencer,
) {
  // Build groups by groupOrder
  const groups = new Map<number, { specifications: TestSpecification[]; maxWorkers: number }>()
  for (const spec of specifications) {
    const order = spec.project.config.sequence.groupOrder
    const maxWorkers = spec.project.config.maxWorkers
    const group = groups.get(order)
    if (group) {
      if (group.maxWorkers !== maxWorkers) {
        const last = group.specifications.at(-1)?.project.name
        throw new Error(`Projects "${last}" and "${spec.project.name}" have different 'maxWorkers' but same 'sequence.groupOrder'.\nProvide unique 'sequence.groupOrder' for them.`)
      }
      group.specifications.push(spec)
    }
    else {
      groups.set(order, { specifications: [spec], maxWorkers })
    }
  }

  const sortedOrders = Array.from(groups.keys()).sort((a, b) => a - b)
  const result: TestSpecification[] = []
  const deferredNonIsolatedMaxOne: TestSpecification[] = []
  const deferredIsolatedMaxOne: TestSpecification[] = []
  const sequentialTests: TestSpecification[][] = []
  const browserTests: TestSpecification[] = []

  function isNonIsolatedMaxOne(spec: TestSpecification) {
    const p = spec.project
    const isolated = p.config.isolate === false
    const maxOne = p.config.maxWorkers === 1
    return isolated && maxOne
  }

  function isIsolatedMaxOne(spec: TestSpecification) {
    const p = spec.project
    const isolated = p.config.isolate === true
    const maxOne = p.config.maxWorkers === 1
    return isolated && maxOne
  }

  function runnerKey(spec: TestSpecification) {
    const env = environments.get(spec)
    const envName = env?.name || ''
    const envOpts = env?.optionsJson || ''
    return `${spec.project.name}|${envName}|${envOpts}`
  }

  for (const order of sortedOrders) {
    const specs = groups.get(order)!.specifications
    const parallelTests: TestSpecification[] = []

    for (const spec of specs) {
      if (spec.pool === 'browser') {
        browserTests.push(spec)
      }
      else if (isNonIsolatedMaxOne(spec)) {
        deferredNonIsolatedMaxOne.push(spec)
      }
      else if (isIsolatedMaxOne(spec)) {
        deferredIsolatedMaxOne.push(spec)
      }
      else {
        parallelTests.push(spec)
      }
    }

    async function clusterize(tests: TestSpecification[]) {
      // Cluster by runner identity to maximize reuse
      const clusters = new Map<string, TestSpecification[]>()
      for (const spec of tests) {
        const key = runnerKey(spec)
        const arr = clusters.get(key)
        if (arr) {
          arr.push(spec)
        }
        else {
          clusters.set(key, [spec])
        }
      }

      const sortedTests: TestSpecification[][] = []

      for (const key of Array.from(clusters.keys()).sort()) {
        const cluster = clusters.get(key)!
        sortedTests.push(await sequencer.sort(cluster))
      }
      return sortedTests
    }

    result.push(...(await clusterize(parallelTests)).flat())

    sequentialTests.push(
      // run isolated one by one
      ...(await clusterize(deferredIsolatedMaxOne)).flatMap(specs => specs.map(s => [s])),
    )
    sequentialTests.push(
      // run isolated together
      ...await clusterize(deferredNonIsolatedMaxOne),
    )
  }

  return {
    browserTests: await sequencer.sort(browserTests),
    parallelTests: result,
    sequentialTests,
  }
}
