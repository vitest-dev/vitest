import type {
  BenchOptions as BenchCompareOptions,
  Fn,
  FnOptions,
  TaskResultCompleted,
  TaskResultRuntimeInfo,
  TaskResultTimestampProviderInfo,
  Task as TinybenchTask,
} from 'tinybench'
import type { SerializedConfig } from './config'
import type { BaselineData, Test, TestBenchmark, TestBenchmarkTask } from './runner/types'
import { isAbsolute, relative } from 'pathe'
import { Bench as Tinybench } from 'tinybench'
import c from 'tinyrainbow'
import { rpc } from './rpc'
import { TestRunner } from './runners/test'
import { getWorkerState } from './utils'

const now = globalThis.performance
  ? globalThis.performance.now.bind(globalThis.performance)
  : Date.now

const kRegistration: unique symbol = Symbol('registration')
const kFromSource: unique symbol = Symbol('fromSource')
const kPerProject: unique symbol = Symbol('perProject')
const kWriteResult: unique symbol = Symbol('writeResult')
export const kFinalize: unique symbol = Symbol('finalize')

type ExtractBenchNames<T extends BenchRegistration<any>[]> = Exclude<{
  [K in keyof T]: T[K] extends BenchRegistration<infer N> ? N : never
}[number], never>

// We throw an error if benchmark did not complete, so it will always be TaskResultCompleted
export type BenchResult = TaskResultCompleted & TaskResultRuntimeInfo & TaskResultTimestampProviderInfo

export interface BenchStorage<T extends string> {
  get: (name: T) => BenchResult
}

export type { BenchOptions as BenchCompareOptions } from 'tinybench'

/**
 * Options accepted by `bench(name, options, fn)`. Extends tinybench's
 * `FnOptions` with Vitest-specific fields.
 */
export interface BenchFnOptions extends FnOptions {
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
  fn?: Fn
  /**
   * Per-benchmark options (`beforeEach`, `beforeAll`, etc.). Absent for
   * registrations created via `bench.from()`.
   */
  fnOpts?: FnOptions
  /**
   * @internal
   */
  [kRegistration]: true
  run: (options?: BenchCompareOptions) => Promise<BenchResult>
}

interface BenchCompare {
  <Args extends BenchRegistration<any>[]>(...args: Args): Promise<BenchStorage<ExtractBenchNames<Args>>>
  <Args extends BenchRegistration<any>[]>(...args: [...Args, BenchCompareOptions]): Promise<BenchStorage<ExtractBenchNames<Args>>>
}

interface BenchFactory {
  <Name extends string>(name: Name | Function, fn: Fn): BenchRegistration<Name>
  <Name extends string>(name: Name | Function, options: BenchFnOptions, fn: Fn): BenchRegistration<Name>
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
  fn: Fn
  fnOpts?: FnOptions
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

export function createBench(test: Test, config: SerializedConfig): Bench {
  let benchIdx = 0
  const pending = new Set<BenchRegistration<any>>()
  const createTinybench = (options?: BenchCompareOptions) => {
    const currentIndex = ++benchIdx
    return new Tinybench({
      signal: test.context.signal,
      name: `${test.fullTestName} ${currentIndex}`,
      retainSamples: config.benchmark.retainSamples,
      ...options,
      now,
    })
  }

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
    bench: Tinybench,
    fromResults?: Map<string, BaselineData>,
  ): BenchStorage<T> => {
    return {
      get(name: T) {
        const stored = fromResults?.get(name)
        if (stored) {
          return stored as BenchResult
        }
        const task = bench.getTask(name)
        if (!task) {
          throw new Error(`task "${name}" was not defined`)
        }
        return task.result as BenchResult
      },
    }
  }

  interface TaskMeta { perProject?: true }

  const serializeBenchmark = (
    tinybenchTasks: TinybenchTask[],
    name: string | undefined,
    taskMeta?: Map<string, TaskMeta>,
    fromTasks?: TestBenchmarkTask[],
  ): TestBenchmark => {
    const tasks: TestBenchmarkTask[] = tinybenchTasks.map((t) => {
      const result = t.result
      if (result.state === 'errored') {
        throw result.error
      }
      if (result.state !== 'completed') {
        throw new Error(`task "${t.name}" did not complete: received "${result.state}"`)
      }
      return {
        name: t.name,
        latency: result.latency,
        throughput: result.throughput,
        period: result.period,
        totalTime: result.totalTime,
        rank: 0,
        ...taskMeta?.get(t.name),
      }
    })
    if (fromTasks) {
      tasks.push(...fromTasks)
    }
    tasks.sort((a, b) => a.latency.mean - b.latency.mean)
    tasks.forEach((task, idx) => {
      task.rank = idx + 1
    })
    return {
      name: name || test.fullTestName,
      tasks,
    }
  }

  const recordBenchmark = async (
    tinybenchTasks: TinybenchTask[],
    name: string | undefined,
    taskMeta?: Map<string, TaskMeta>,
    fromTasks?: TestBenchmarkTask[],
  ) => {
    const serializedBenchmark = serializeBenchmark(tinybenchTasks, name, taskMeta, fromTasks)
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

  const runBenchmarks = async (tinybench: Tinybench) => {
    const workerState = getWorkerState()
    const getterTracker = workerState.getterTracker
    getterTracker?.resetInvocations()
    try {
      return await TestRunner.runBenchmarks(tinybench)
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
            `Benchmark ${c.bold(`"${tinybench.name}"`)} accessed module export getters too many times.`,
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
    fn: Fn,
    fnOpts: FnOptions | undefined,
    options: BenchCompareOptions | undefined,
    meta: TaskMeta | undefined,
    writeResult: string | undefined,
  ): Promise<BenchResult> => {
    const tinybench = createTinybench(options).add(name, fn, fnOpts)
    const tasks = await runBenchmarks(tinybench)
    const task = tinybench.getTask(name)!
    if (task.result.state === 'errored') {
      throw task.result.error
    }
    await recordBenchmark(tasks, tinybench.name, meta ? new Map([[name, meta]]) : undefined)
    if (writeResult) {
      await writeResultArtifact(writeResult, task.result as BenchResult)
    }
    return task.result as BenchResult
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

  const bench: Bench = (nameOrFunction: string | Function, a: Fn | BenchFnOptions, b?: Fn | BenchFnOptions) => {
    validateBenchmarkProject(config)
    const { fn, fnOpts, writeResult, perProject } = normalizeBenchArgs(a, b)
    const name = typeof nameOrFunction === 'function' ? nameOrFunction.name || '<anonymous>' : nameOrFunction
    const meta: TaskMeta | undefined = perProject ? { perProject: true } : undefined
    const registration: RunnableRegistration<string> = {
      [kRegistration]: true,
      name,
      fn,
      fnOpts,
      run: (options?: BenchCompareOptions) => {
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

    // extract optional trailing BenchCompareOptions argument
    const lastArg = args[args.length - 1]
    const isOptions = lastArg != null && typeof lastArg === 'object' && !(kRegistration in lastArg)
    const benchOptions = isOptions ? args.pop() as BenchCompareOptions : undefined
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

    const tinybench = createTinybench(benchOptions)
    runnable.forEach((reg) => {
      tinybench.add(reg.name, reg.fn, reg.fnOpts)
    })

    let tasks: TinybenchTask[] = []
    if (runnable.length > 0) {
      tasks = await runBenchmarks(tinybench)
      const errors = tinybench.tasks
        .filter(task => task.result.state === 'errored')
        .map(task => (task.result as any).error)
      if (errors.length > 0) {
        throw new AggregateError(errors, 'Some benchmarks failed')
      }
    }

    await recordBenchmark(tasks, tinybench.name, taskMeta, fromTasks)

    // write artifacts for every runnable registration that requested it. We
    // do this after recording so a write failure can't be confused with a
    // benchmark failure in the reporter output.
    await Promise.all(
      runnable
        .filter(reg => reg[kWriteResult] != null)
        .map((reg) => {
          const task = tinybench.getTask(reg.name)!
          return writeResultArtifact(reg[kWriteResult]!, task.result as BenchResult)
        }),
    )

    return createCompareStorage(tinybench, fromResults)
  }

  bench[kFinalize] = () => {
    if (pending.size === 0) {
      return
    }
    const names = [...pending].map(reg => `"${reg.name}"`).join(', ')
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
  a: Fn | BenchFnOptions,
  b: Fn | BenchFnOptions | undefined,
): { fn: Fn; fnOpts: FnOptions | undefined; writeResult: string | undefined; perProject: boolean } {
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
  // `registration.fnOpts` and tinybench's `add` sees the same object the
  // caller passed in.
  if (a.writeResult === undefined && a.perProject === undefined) {
    return { fn: b, fnOpts: a as FnOptions, writeResult: undefined, perProject: false }
  }
  const { writeResult, perProject, ...fnOpts } = a
  return {
    fn: b,
    fnOpts: Object.keys(fnOpts).length > 0 ? fnOpts as FnOptions : undefined,
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
