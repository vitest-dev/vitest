import type {
  BenchOptions as BenchCompareOptions,
  Fn,
  FnOptions,
  TaskResultCompleted,
  TaskResultRuntimeInfo,
  TaskResultTimestampProviderInfo,
} from 'tinybench'
import type { SerializedConfig } from './config'
import type { BaselineData, Test, TestBenchmark, TestBenchmarkTask } from './runner/types'
import { isAbsolute, relative } from 'pathe'
import c from 'tinyrainbow'
import { createDefaultBenchmarkProvider } from './benchmark/default-provider'
import { rpc } from './rpc'
import { getWorkerState } from './utils'

const kRegistration: unique symbol = Symbol('registration')
const kFromSource: unique symbol = Symbol('fromSource')
const kPerProject: unique symbol = Symbol('perProject')
const kWriteResult: unique symbol = Symbol('writeResult')
export const kFinalize: unique symbol = Symbol('finalize')

type ExtractBenchNames<T extends BenchRegistration<any>[]> = Exclude<{
  [K in keyof T]: T[K] extends BenchRegistration<infer N> ? N : never
}[number], never>

/**
 * A benchmarked function. Vitest-owned and engine-agnostic.
 */
export type BenchFn = Fn

/**
 * Per-benchmark lifecycle hooks passed to `bench(name, hooks, fn)`.
 */
export type BenchHooks = FnOptions

/**
 * Engine-neutral run options forwarded to a {@link BenchmarkProvider}. These
 * come from the optional trailing options argument of `bench.compare()` and
 * `registration.run()`.
 */
export type BenchRunOptions = BenchCompareOptions

/**
 * The result of a single benchmark, produced by a {@link BenchmarkProvider}.
 * Structurally compatible with tinybench's task statistics so it flows
 * unchanged into the reporter, `bench.from()` baselines and comparison tables.
 * The `name` matches the corresponding {@link BenchRegistration}.
 */
export interface BenchResult extends TaskResultCompleted, TaskResultRuntimeInfo, TaskResultTimestampProviderInfo {
  /** The registered benchmark name this result belongs to. */
  name: string
}

/**
 * A benchmark defined by `bench()` (or `bench.from()`), as seen by a
 * {@link BenchmarkProvider}. `fn`/`fnOpts` are absent for `bench.from()`
 * registrations, which are resolved from a stored baseline instead of run.
 */
export interface BenchRegistrationInput {
  name: string
  fn: BenchFn
  fnOpts?: BenchHooks
}

/**
 * The set of benchmarks registered by a single test, handed to
 * {@link BenchmarkProvider.run}.
 */
export interface BenchmarkGroup {
  /** The test that registered these benchmarks. */
  test: Test
  /** The resolved benchmark configuration for the current project. */
  config: SerializedConfig['benchmark']
  /** The runnable registrations, in registration order. */
  registrations: BenchRegistrationInput[]
  /** Engine-neutral run options, when provided by the caller. */
  options?: BenchRunOptions
}

/**
 * Executes the benchmarks of a single test and returns their results.
 *
 * The returned array is the sole source of results: it's what `bench().run()`
 * resolves to and what the reporter serializes. Results are matched to
 * registrations by `name`; return one {@link BenchResult} per registration.
 *
 * @experimental
 */
export interface BenchmarkProvider {
  run: (group: BenchmarkGroup) => Promise<BenchResult[]>
}

/**
 * The module contract a custom benchmark provider must satisfy. The module's
 * default export must be an object of this shape.
 *
 * @experimental
 */
export interface BenchmarkProviderModule {
  /** Factory that creates the provider used to run benchmarks. */
  getProvider: () => BenchmarkProvider | Promise<BenchmarkProvider>
}

interface BenchmarkProviderLoader {
  import: (id: string) => Promise<Record<string, any>>
}

let cachedProvider: Promise<BenchmarkProvider> | undefined

async function loadProviderModule(
  provider: string,
  loader: BenchmarkProviderLoader,
): Promise<BenchmarkProviderModule> {
  let mod: Record<string, any>
  try {
    mod = await loader.import(provider)
  }
  catch (error) {
    throw new Error(
      `Failed to load benchmark provider from "${provider}".`,
      { cause: error },
    )
  }
  if (mod.default == null) {
    throw new Error(
      `Benchmark provider loaded from "${provider}" did not have a default export.`,
    )
  }
  return mod.default
}

/**
 * Resolves the benchmark provider for the current worker, importing a custom
 * provider module on first use. The result is cached for the lifetime of the
 * worker so a custom provider is imported at most once.
 */
export function resolveBenchmarkProvider(
  config: SerializedConfig,
  loader: BenchmarkProviderLoader,
): Promise<BenchmarkProvider> {
  if (!cachedProvider) {
    const provider = config.benchmark.provider
    cachedProvider = provider === 'default' || !provider
      ? Promise.resolve(createDefaultBenchmarkProvider(config))
      : Promise.resolve(loadProviderModule(provider, loader)).then(mod => mod.getProvider())
  }
  return cachedProvider
}

export interface BenchStorage<T extends string> {
  get: (name: T) => BenchResult
}

export type { BenchOptions as BenchCompareOptions } from 'tinybench'

/**
 * Options accepted by `bench(name, options, fn)`. Extends the per-benchmark
 * lifecycle hooks with Vitest-specific fields.
 */
export interface BenchFnOptions extends BenchHooks {
  /**
   * Path (relative to the project root) where the benchmark result is written
   * after a successful run. The string `${projectName}` is substituted with
   * the current project name. Absolute paths are accepted as long as they
   * resolve inside the project root.
   */
  writeResult?: string
  /**
   * Mark this benchmark as a per-project entry. Per-project tasks still appear
   * in the inline comparison table for the current run, and Vitest additionally
   * collects them across projects and prints a single cross-project table at
   * the end of the run.
   */
  perProject?: boolean
}

export interface BenchRegistration<Name extends string> {
  name: Name
  /**
   * The benchmark function. Absent for registrations created via `bench.from()`.
   */
  fn?: BenchFn
  /**
   * Per-benchmark options (`beforeEach`, `beforeAll`, etc.). Absent for
   * registrations created via `bench.from()`.
   */
  fnOpts?: BenchHooks
  /**
   * @internal
   */
  [kRegistration]: true
  run: (options?: BenchRunOptions) => Promise<BenchResult>
}

interface BenchCompare {
  <Args extends BenchRegistration<any>[]>(...args: Args): Promise<BenchStorage<ExtractBenchNames<Args>>>
  <Args extends BenchRegistration<any>[]>(...args: [...Args, BenchRunOptions]): Promise<BenchStorage<ExtractBenchNames<Args>>>
}

interface BenchFactory {
  <Name extends string>(name: Name | Function, fn: BenchFn): BenchRegistration<Name>
  <Name extends string>(name: Name | Function, options: BenchFnOptions, fn: BenchFn): BenchRegistration<Name>
}

export interface BenchFromSource {
  (): BaselineData | Promise<BaselineData>
}

interface BenchFrom {
  <Name extends string>(name: Name | Function, source: string | BenchFromSource): BenchRegistration<Name>
}

export interface Bench extends BenchFactory {
  compare: BenchCompare
  from: BenchFrom
  /** @internal */
  [kFinalize]: () => void
}

interface RunnableRegistration<Name extends string> extends BenchRegistration<Name> {
  fn: BenchFn
  fnOpts?: BenchHooks
  [kWriteResult]?: string
  [kPerProject]?: true
}

interface FromRegistration<Name extends string> extends BenchRegistration<Name> {
  [kFromSource]: string | BenchFromSource
}

function isFromRegistration(reg: BenchRegistration<any>): reg is FromRegistration<any> {
  return kFromSource in reg
}

function substitutePath(template: string, projectName: string | undefined): string {
  return template.replace(/\$\{projectName\}/g, projectName ?? '')
}

export function createBench(
  test: Test,
  config: SerializedConfig,
  loader: BenchmarkProviderLoader,
): Bench {
  const pending = new Set<BenchRegistration<any>>()

  const resolveTemplate = (template: string) => substitutePath(template, config.benchmark.projectName)

  const resolveFromSource = async (source: string | BenchFromSource): Promise<BaselineData> => {
    if (typeof source === 'function') {
      return source()
    }
    const resolved = resolveTemplate(source)
    const data = await rpc().readBenchmarkResult(resolved)
    if (data == null) {
      throw new Error(`\`bench.from()\` could not find a result file at "${resolved}". Run the source benchmark first to create it.`)
    }
    return data
  }

  const taskFromBaseline = (
    name: string,
    data: BaselineData,
  ): TestBenchmarkTask => ({
    name,
    latency: data.latency,
    throughput: data.throughput,
    period: data.period,
    totalTime: data.totalTime,
    rank: 0,
    fromStore: true,
  })

  const createCompareStorage = <T extends string>(
    results: Map<string, BenchResult>,
    fromResults?: Map<string, BaselineData>,
  ): BenchStorage<T> => {
    return {
      get(name: T) {
        const stored = fromResults?.get(name)
        if (stored) {
          return stored as BenchResult
        }
        const result = results.get(name)
        if (!result) {
          throw new Error(`task "${name}" was not defined`)
        }
        return result
      },
    }
  }

  interface TaskMeta { perProject?: true }

  const serializeBenchmark = (
    results: BenchResult[],
    name: string,
    taskMeta?: Map<string, TaskMeta>,
    fromTasks?: TestBenchmarkTask[],
  ): TestBenchmark => {
    const tasks: TestBenchmarkTask[] = results.map(result => ({
      name: result.name,
      latency: result.latency,
      throughput: result.throughput,
      period: result.period,
      totalTime: result.totalTime,
      rank: 0,
      ...taskMeta?.get(result.name),
    }))
    if (fromTasks) {
      tasks.push(...fromTasks)
    }
    tasks.sort((a, b) => a.latency.mean - b.latency.mean)
    tasks.forEach((task, idx) => {
      task.rank = idx + 1
    })
    return {
      name,
      tasks,
    }
  }

  const recordBenchmark = async (
    results: BenchResult[],
    name: string,
    taskMeta?: Map<string, TaskMeta>,
    fromTasks?: TestBenchmarkTask[],
  ) => {
    const serializedBenchmark = serializeBenchmark(results, name, taskMeta, fromTasks)
    test.benchmarks.push(serializedBenchmark)
    await rpc().onTestBenchmark(test.id, serializedBenchmark)
  }

  const writeResultArtifact = async (template: string, result: BenchResult) => {
    const resolved = resolveTemplate(template)
    const data: BaselineData = {
      latency: result.latency,
      throughput: result.throughput,
      period: result.period,
      totalTime: result.totalTime,
    }
    await rpc().writeBenchmarkResult(resolved, data)
  }

  const groupName = (options: BenchRunOptions | undefined) => options?.name ?? test.fullTestName

  const runGroup = async (
    registrations: BenchRegistrationInput[],
    options: BenchRunOptions | undefined,
  ): Promise<Map<string, BenchResult>> => {
    const workerState = getWorkerState()
    const getterTracker = workerState.getterTracker
    getterTracker?.resetInvocations()
    try {
      const provider = await resolveBenchmarkProvider(config, loader)
      const results = await provider.run({ test, config: config.benchmark, registrations, options })
      const byName = new Map<string, BenchResult>()
      for (const result of results) {
        byName.set(result.name, result)
      }
      return byName
    }
    finally {
      const excessiveInvocations = config.benchmark.suppressExportGetterWarnings
        ? undefined
        : getterTracker?.getExcessiveInvocations()
      if (excessiveInvocations?.length) {
        const entries = excessiveInvocations
          .map(({ moduleId, exportName }) => `  - ${formatModuleId(moduleId, workerState.config.root)} > ${exportName}`)
          .join('\n')
        console.warn(
          [
            c.yellow(c.bold('Benchmark Warning')),
            `Benchmark ${c.bold(`"${groupName(options)}"`)} accessed module export getters too many times.`,
            '',
            'This can make results unreliable because export getters add overhead.',
            'See https://vitest.dev/guide/benchmarking#module-runner-overhead',
            '',
            'Tracked exports:',
            entries,
          ].join('\n'),
        )
      }
    }
  }

  const runSingle = async (
    name: string,
    fn: BenchFn,
    fnOpts: BenchHooks | undefined,
    options: BenchRunOptions | undefined,
    meta: TaskMeta | undefined,
    writeResult: string | undefined,
  ): Promise<BenchResult> => {
    const results = await runGroup([{ name, fn, fnOpts }], options)
    const result = results.get(name)
    if (!result) {
      throw new Error(`benchmark provider did not return a result for "${name}"`)
    }
    await recordBenchmark([result], groupName(options), meta ? new Map([[name, meta]]) : undefined)
    if (writeResult) {
      await writeResultArtifact(writeResult, result)
    }
    return result
  }

  const runFrom = async (
    name: string,
    source: string | BenchFromSource,
  ): Promise<BenchResult> => {
    const data = await resolveFromSource(source)
    const benchmark: TestBenchmark = {
      name: test.fullTestName,
      tasks: [{ ...taskFromBaseline(name, data), rank: 1 }],
    }
    test.benchmarks.push(benchmark)
    await rpc().onTestBenchmark(test.id, benchmark)
    return data as BenchResult
  }

  const bench: Bench = (nameOrFunction: string | Function, a: BenchFn | BenchFnOptions, b?: BenchFn | BenchFnOptions) => {
    validateBenchmarkProject(config)
    const { fn, fnOpts, writeResult, perProject } = normalizeBenchArgs(a, b)
    const name = typeof nameOrFunction === 'function' ? nameOrFunction.name || '<anonymous>' : nameOrFunction
    const meta: TaskMeta | undefined = perProject ? { perProject: true } : undefined
    const registration: RunnableRegistration<string> = {
      [kRegistration]: true,
      name,
      fn,
      fnOpts,
      run: (options?: BenchRunOptions) => {
        pending.delete(registration)
        return runSingle(name, fn, fnOpts, options, meta, writeResult)
      },
    }
    if (perProject) {
      registration[kPerProject] = true
    }
    if (writeResult) {
      registration[kWriteResult] = writeResult
    }
    pending.add(registration)
    return registration
  }

  bench.from = <Name extends string>(nameOrFunction: Name | Function, source: string | BenchFromSource): BenchRegistration<Name> => {
    validateBenchmarkProject(config)
    if (typeof nameOrFunction !== 'string' && typeof nameOrFunction !== 'function') {
      throw new TypeError('`bench.from()` requires a name (string or named function) as its first argument.')
    }
    if (typeof source !== 'string' && typeof source !== 'function') {
      throw new TypeError('`bench.from()` expects a string path or a function returning the result data as its second argument.')
    }
    const name = (typeof nameOrFunction === 'function' ? nameOrFunction.name || '<anonymous>' : nameOrFunction) as Name
    const registration: FromRegistration<Name> = {
      [kRegistration]: true,
      [kFromSource]: source,
      name,
      run: () => {
        pending.delete(registration)
        return runFrom(name, source)
      },
    }
    pending.add(registration)
    return registration
  }

  bench.compare = async (...args) => {
    validateBenchmarkProject(config)

    // extract optional trailing BenchRunOptions argument
    const lastArg = args.at(-1)
    const isOptions = lastArg != null && typeof lastArg === 'object' && !(kRegistration in lastArg)
    const benchOptions = isOptions ? args.pop() as BenchRunOptions : undefined
    const registrations = args as BenchRegistration<any>[]

    // Mark every passed-in registration as consumed before validation so a
    // throwing `bench.compare()` (wrong arity, wrong shape) doesn't also
    // trigger the unrun-bench warning — the user's intent was to consume them.
    for (const reg of registrations) {
      if (reg != null && typeof reg === 'object' && kRegistration in reg) {
        pending.delete(reg)
      }
    }

    if (registrations.length < 2) {
      throw new SyntaxError(`\`bench.compare()\` requires at least 2 benchmarks, received ${registrations.length} instead. ${registrations.length === 1 ? 'Consider calling `bench().run()`. ' : 'Define benchmarks by calling `bench()`. '}See https://vitest.dev/guide/benchmarking#comparing-benchmarks`)
    }
    for (const reg of registrations) {
      if (reg == null || typeof reg !== 'object' || !(kRegistration in reg)) {
        throw new SyntaxError('`bench.compare()` expects every argument to be the return value of `bench` or `bench.from`.')
      }
    }

    const runnable: RunnableRegistration<any>[] = []
    const fromEntries: FromRegistration<any>[] = []
    for (const reg of registrations) {
      if (isFromRegistration(reg)) {
        fromEntries.push(reg)
      }
      else {
        runnable.push(reg as RunnableRegistration<any>)
      }
    }

    const taskMeta = new Map<string, TaskMeta>()
    for (const reg of runnable) {
      if (reg[kPerProject]) {
        taskMeta.set(reg.name, { perProject: true })
      }
    }

    const fromResults = new Map<string, BaselineData>()
    const fromTasks: TestBenchmarkTask[] = []
    if (fromEntries.length > 0) {
      const resolved = await Promise.all(
        fromEntries.map(async (reg) => {
          const data = await resolveFromSource(reg[kFromSource])
          return { reg, data }
        }),
      )
      for (const { reg, data } of resolved) {
        fromResults.set(reg.name, data)
        fromTasks.push(taskFromBaseline(reg.name, data))
      }
    }

    let results = new Map<string, BenchResult>()
    if (runnable.length > 0) {
      results = await runGroup(
        runnable.map(reg => ({ name: reg.name, fn: reg.fn, fnOpts: reg.fnOpts })),
        benchOptions,
      )
    }

    await recordBenchmark(Array.from(results.values()), groupName(benchOptions), taskMeta, fromTasks)

    // write artifacts for every runnable registration that requested it. We
    // do this after recording so a write failure can't be confused with a
    // benchmark failure in the reporter output.
    await Promise.all(
      runnable
        .filter(reg => reg[kWriteResult] != null)
        .map((reg) => {
          const result = results.get(reg.name)!
          return writeResultArtifact(reg[kWriteResult]!, result)
        }),
    )

    return createCompareStorage(results, fromResults)
  }

  bench[kFinalize] = () => {
    if (pending.size === 0) {
      return
    }
    const names = Array.from(pending, reg => `"${reg.name}"`).join(', ')
    pending.clear()
    console.warn(
      [
        c.yellow(c.bold('Benchmark Warning')),
        `Test ${c.bold(`"${test.fullTestName}"`)} registered benchmarks that never ran: ${names}.`,
        '',
        'Call `.run()` on the registration, or pass it to `bench.compare()`.',
        'See https://vitest.dev/guide/benchmarking#defining-a-benchmark',
      ].join('\n'),
    )
  }

  return bench
}

function formatModuleId(moduleId: string, root: string): string {
  if (!root || !isAbsolute(moduleId)) {
    return moduleId
  }
  return relative(root, moduleId)
}

function normalizeBenchArgs(
  a: BenchFn | BenchFnOptions,
  b: BenchFn | BenchFnOptions | undefined,
): { fn: BenchFn; fnOpts: BenchHooks | undefined; writeResult: string | undefined; perProject: boolean } {
  if (typeof a === 'function') {
    if (b !== undefined) {
      throw new TypeError('`bench()` does not accept options as the third argument. Pass options as the second argument instead: `bench(name, options, fn)`.')
    }
    return { fn: a, fnOpts: undefined, writeResult: undefined, perProject: false }
  }
  if (typeof b !== 'function') {
    throw new TypeError('`bench()` expects a benchmark function. Call `bench(name, fn)` or `bench(name, options, fn)`.')
  }
  // Strip vitest-specific fields only when present so we don't allocate a new
  // object — preserving referential identity matters: users inspect
  // `registration.fnOpts` and the provider sees the same object the caller
  // passed in.
  if (a.writeResult === undefined && a.perProject === undefined) {
    return { fn: b, fnOpts: a as BenchHooks, writeResult: undefined, perProject: false }
  }
  const { writeResult, perProject, ...fnOpts } = a
  return {
    fn: b,
    fnOpts: Object.keys(fnOpts).length > 0 ? fnOpts as BenchHooks : undefined,
    writeResult,
    perProject: perProject ?? false,
  }
}

function validateBenchmarkProject(config: SerializedConfig) {
  if (!config.benchmark.enabled) {
    throw new Error(
      `Cannot use the \`bench\` test-context fixture within a regular test run. `
      + `Benchmarks are inherently flaky, so Vitest runs them in a dedicated project based on the \`benchmark.include\` pattern (default \`**/*.{bench,benchmark}.?(c|m)[jt]s?(x)\`). `
      + `Move this code to a file matched by \`benchmark.include\`, and make sure \`bench\` is destructured from the test context (\`test('...', async ({ bench }) => { ... })\`) — it is not a top-level export of \`vitest\`. `
      + `See https://vitest.dev/guide/benchmarking#stability`,
    )
  }
}
