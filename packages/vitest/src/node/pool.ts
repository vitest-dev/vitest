import type { Awaitable } from '@vitest/utils'
import type { ContextTestEnvironment } from '../types/worker'
import type { Vitest } from './core'
import type { PoolTask } from './pools/types'
import type { TestProject } from './project'
import type { TestSpecification } from './test-specification'
import type { BuiltinPool, ResolvedConfig } from './types/config'
import * as nodeos from 'node:os'
import { isatty } from 'node:tty'
import { resolve } from 'pathe'
import { version as viteVersion } from 'vite'
import { rootDir } from '../paths'
import { isWindows } from '../utils/env'
import { getWorkerMemoryLimit, stringToBytes } from '../utils/memory-limit'
import { getSpecificationsOptions } from '../utils/test-helpers'
import { createBrowserPool } from './pools/browser'
import { Pool } from './pools/pool'

const suppressWarningsPath = resolve(rootDir, './suppress-warnings.cjs')

type RunWithFiles = (
  files: TestSpecification[],
  invalidates?: string[],
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

    const taskGroups: {
      tasks: PoolTask[]
      maxWorkers: number
      // browser pool has a more complex logic, so we keep it separately for now
      browserSpecs: TestSpecification[]
    }[] = []
    let workerId = 0

    const sorted = await sequencer.sort(specs)
    const { environments, tags } = await getSpecificationsOptions(specs)
    const groups = groupSpecs(sorted, environments)

    const projectEnvs = new WeakMap<TestProject, Partial<NodeJS.ProcessEnv>>()
    const projectExecArgvs = new WeakMap<TestProject, string[]>()

    for (const group of groups) {
      if (!group) {
        continue
      }

      const taskGroup: PoolTask[] = []
      const browserSpecs: TestSpecification[] = []
      taskGroups.push({
        tasks: taskGroup,
        maxWorkers: group.maxWorkers,
        browserSpecs,
      })

      for (const specs of group.specs) {
        const { project, pool } = specs[0]
        if (pool === 'browser') {
          browserSpecs.push(...specs)
          continue
        }

        const environment = environments.get(specs[0])!
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

          // env are case-insensitive on Windows, but spawned processes don't support it
          if (isWindows) {
            for (const name in env) {
              env[name.toUpperCase()] = env[name]
            }
          }
          projectEnvs.set(project, env)
        }

        let execArgv = projectExecArgvs.get(project)
        if (!execArgv) {
          const conditions = resolveConditions(project)
          execArgv = [
            ...options.execArgv,
            ...conditions,
            ...project.config.execArgv,
          ]
          projectExecArgvs.set(project, execArgv)
        }

        taskGroup.push({
          context: {
            files: specs.map(spec => ({
              filepath: spec.moduleId,
              fileTags: tags.get(spec),
              testLocations: spec.testLines,
              testNamePattern: spec.testNamePattern,
              testIds: spec.testIds,
              testTagsFilter: spec.testTagsFilter,
            })),
            invalidates,
            providedContext: project.getProvidedContext(),
            workerId: workerId++,
            environment,
          },
          project,
          env,
          execArgv,
          worker: pool,
          isolate: project.config.isolate,
          memoryLimit: getMemoryLimit(ctx.config, pool) ?? null,
        })
      }
    }

    const results: PromiseSettledResult<void>[] = []

    for (const { tasks, browserSpecs, maxWorkers } of taskGroups) {
      pool.setMaxWorkers(maxWorkers)

      const promises = tasks.map(async (task) => {
        if (ctx.isCancelling) {
          return ctx.state.cancelFiles(task.context.files, task.project)
        }

        try {
          await pool.run(task, method)
        }
        catch (error) {
          // Intentionally cancelled
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
    }

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
      await Promise.all([
        pool.close(),
        browserPool?.close?.(),
        ...ctx.projects.map(project => project.typechecker?.stop()),
      ])
    },
  }
}

function resolveOptions(ctx: Vitest) {
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
      '--experimental-import-meta-resolve',
      // https://github.com/vitest-dev/vitest/issues/8896
      ...((globalThis as any).Deno || process.versions.pnp ? [] : ['--require', suppressWarningsPath]),
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

function resolveConditions(project: TestProject) {
  // in addition to resolve.conditions Vite also adds production/development,
  // see: https://github.com/vitejs/vite/blob/af2aa09575229462635b7cbb6d248ca853057ba2/packages/vite/src/node/plugins/resolve.ts#L1056-L1080
  const viteMajor = Number(viteVersion.split('.')[0])
  const viteConfig = project.vite.config

  const potentialConditions = new Set(viteMajor >= 6
    ? (viteConfig.ssr.resolve?.conditions ?? [])
    : [
        'production',
        'development',
        ...(viteConfig.resolve.conditions ?? []),
      ])

  return [...potentialConditions]
    .filter((condition) => {
      if (condition === 'production') {
        return viteConfig.isProduction
      }
      if (condition === 'development') {
        return !viteConfig.isProduction
      }
      return true
    })
    .map((condition) => {
      if (viteMajor >= 6 && condition === 'development|production') {
        return viteConfig.isProduction ? 'production' : 'development'
      }
      return condition
    })
    .flatMap(c => ['--conditions', c])
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

function groupSpecs(specs: TestSpecification[], environments: WeakMap<TestSpecification, ContextTestEnvironment>) {
  // Test files are passed to test runner one at a time, except for Typechecker or when "--maxWorker=1 --no-isolate"
  type SpecsForRunner = TestSpecification[]

  // Tests in a single group are executed with `maxWorkers` parallelism.
  // Next group starts running after previous finishes - allows real sequential tests.
  interface Groups { specs: SpecsForRunner[]; maxWorkers: number; typecheck?: boolean }
  const groups: Groups[] = []

  // Files without file parallelism but without explicit sequence.groupOrder
  const sequential: Groups = { specs: [], maxWorkers: 1 }

  // Type tests are run in a single group, per project
  const typechecks: Record<string, TestSpecification[]> = {}

  const serializedEnvironmentOptions = new Map<ContextTestEnvironment, string>()

  function getSerializedOptions(env: ContextTestEnvironment) {
    const options = serializedEnvironmentOptions.get(env)

    if (options) {
      return options
    }

    const serialized = JSON.stringify(env.options)
    serializedEnvironmentOptions.set(env, serialized)
    return serialized
  }

  function isEqualEnvironments(a: TestSpecification, b: TestSpecification) {
    const aEnv = environments.get(a)
    const bEnv = environments.get(b)

    if (!aEnv && !bEnv) {
      return true
    }

    if (!aEnv || !bEnv || aEnv.name !== bEnv.name) {
      return false
    }

    if (!aEnv.options && !bEnv.options) {
      return true
    }

    if (!aEnv.options || !bEnv.options) {
      return false
    }

    return getSerializedOptions(aEnv) === getSerializedOptions(bEnv)
  }

  specs.forEach((spec) => {
    if (spec.pool === 'typescript') {
      typechecks[spec.project.name] ||= []
      typechecks[spec.project.name].push(spec)
      return
    }

    const order = spec.project.config.sequence.groupOrder
    const isolate = spec.project.config.isolate

    // Files that have disabled parallelism and default groupOrder are set into their own group
    if (isolate === true && order === 0 && spec.project.config.maxWorkers === 1) {
      return sequential.specs.push([spec])
    }

    const maxWorkers = resolveMaxWorkers(spec.project)
    groups[order] ||= { specs: [], maxWorkers }

    // Multiple projects with different maxWorkers but same groupOrder
    if (groups[order].maxWorkers !== maxWorkers) {
      const last = groups[order].specs.at(-1)?.at(-1)?.project.name

      throw new Error(`Projects "${last}" and "${spec.project.name}" have different 'maxWorkers' but same 'sequence.groupOrder'.\nProvide unique 'sequence.groupOrder' for them.`)
    }

    // Non-isolated single worker can receive all files at once
    if (isolate === false && maxWorkers === 1) {
      const previous = groups[order].specs[0]?.[0]

      if (previous && previous.project.name === spec.project.name && isEqualEnvironments(spec, previous)) {
        return groups[order].specs[0].push(spec)
      }
    }

    groups[order].specs.push([spec])
  })

  let order = Math.max(0, ...groups.keys()) + 1

  for (const projectName in typechecks) {
    const maxWorkers = resolveMaxWorkers(typechecks[projectName][0].project)
    const previous = groups[order - 1]
    if (previous && previous.typecheck && maxWorkers !== previous.maxWorkers) {
      order += 1
    }

    groups[order] ||= { specs: [], maxWorkers, typecheck: true }
    groups[order].specs.push(typechecks[projectName])
  }

  if (sequential.specs.length) {
    groups.push(sequential)
  }

  return groups
}
