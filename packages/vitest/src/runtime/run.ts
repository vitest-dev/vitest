import { performance } from 'perf_hooks'
import limit from 'p-limit'
import type { Benchmark, BenchmarkResult, File, HookCleanupCallback, HookListener, ResolvedConfig, Suite, SuiteHooks, Task, TaskResult, TaskState, Test } from '../types'
import { vi } from '../integrations/vi'
import { clearTimeout, createDefer, getFullName, getWorkerState, hasFailed, hasTests, isBenchmarkMode, isBrowser, isNode, partitionSuiteChildren, setTimeout, shuffle } from '../utils'
import { getState, setState } from '../integrations/chai/jest-expect'
import { GLOBAL_EXPECT } from '../integrations/chai/constants'
import { takeCoverageInsideWorker } from '../integrations/coverage'
import { getBenchmarkFactory, getFn, getHooks } from './map'
import { rpc } from './rpc'
import { collectTests } from './collect'
import { processError } from './error'

const now = Date.now

function updateSuiteHookState(suite: Task, name: keyof SuiteHooks, state: TaskState) {
  if (!suite.result)
    suite.result = { state: 'run' }
  if (!suite.result?.hooks)
    suite.result.hooks = {}
  const suiteHooks = suite.result.hooks
  if (suiteHooks) {
    suiteHooks[name] = state
    updateTask(suite)
  }
}

export async function callSuiteHook<T extends keyof SuiteHooks>(
  suite: Suite,
  currentTask: Task,
  name: T,
  args: SuiteHooks[T][0] extends HookListener<infer A, any> ? A : never,
): Promise<HookCleanupCallback[]> {
  const callbacks: HookCleanupCallback[] = []
  if (name === 'beforeEach' && suite.suite) {
    callbacks.push(
      ...await callSuiteHook(suite.suite, currentTask, name, args),
    )
  }

  updateSuiteHookState(currentTask, name, 'run')
  callbacks.push(
    ...await Promise.all(getHooks(suite)[name].map(fn => fn(...(args as any)))),
  )
  updateSuiteHookState(currentTask, name, 'pass')

  if (name === 'afterEach' && suite.suite) {
    callbacks.push(
      ...await callSuiteHook(suite.suite, currentTask, name, args),
    )
  }

  return callbacks
}

const packs = new Map<string, TaskResult | undefined>()
let updateTimer: any
let previousUpdate: Promise<void> | undefined

function updateTask(task: Task) {
  packs.set(task.id, task.result)

  clearTimeout(updateTimer)
  updateTimer = setTimeout(() => {
    previousUpdate = sendTasksUpdate()
  }, 10)
}

async function sendTasksUpdate() {
  clearTimeout(updateTimer)
  await previousUpdate

  if (packs.size) {
    const p = rpc().onTaskUpdate(Array.from(packs))
    packs.clear()
    return p
  }
}

export async function runTest(test: Test) {
  if (test.mode !== 'run') {
    const { getSnapshotClient } = await import('../integrations/snapshot/chai')
    getSnapshotClient().skipTestSnapshots(test)
    return
  }

  if (test.result?.state === 'fail') {
    updateTask(test)
    return
  }

  const start = now()

  test.result = {
    state: 'run',
    startTime: start,
  }
  updateTask(test)

  clearModuleMocks()

  if (isNode) {
    const { getSnapshotClient } = await import('../integrations/snapshot/chai')
    await getSnapshotClient().setTest(test)
  }

  const workerState = getWorkerState()

  workerState.current = test

  let beforeEachCleanups: HookCleanupCallback[] = []
  try {
    beforeEachCleanups = await callSuiteHook(test.suite, test, 'beforeEach', [test.context, test.suite])
    setState({
      assertionCalls: 0,
      isExpectingAssertions: false,
      isExpectingAssertionsError: null,
      expectedAssertionsNumber: null,
      expectedAssertionsNumberErrorGen: null,
      testPath: test.suite.file?.filepath,
      currentTestName: getFullName(test),
    }, (globalThis as any)[GLOBAL_EXPECT])
    await getFn(test)()
    const {
      assertionCalls,
      expectedAssertionsNumber,
      expectedAssertionsNumberErrorGen,
      isExpectingAssertions,
      isExpectingAssertionsError,
      // @ts-expect-error local is private
    } = test.context._local
      ? test.context.expect.getState()
      : getState((globalThis as any)[GLOBAL_EXPECT])
    if (expectedAssertionsNumber !== null && assertionCalls !== expectedAssertionsNumber)
      throw expectedAssertionsNumberErrorGen!()
    if (isExpectingAssertions === true && assertionCalls === 0)
      throw isExpectingAssertionsError

    test.result.state = 'pass'
  }
  catch (e) {
    test.result.state = 'fail'
    test.result.error = processError(e)
  }

  try {
    await callSuiteHook(test.suite, test, 'afterEach', [test.context, test.suite])
    await Promise.all(beforeEachCleanups.map(i => i?.()))
  }
  catch (e) {
    test.result.state = 'fail'
    test.result.error = processError(e)
  }

  // if test is marked to be failed, flip the result
  if (test.fails) {
    if (test.result.state === 'pass') {
      test.result.state = 'fail'
      test.result.error = processError(new Error('Expect test to fail'))
    }
    else {
      test.result.state = 'pass'
      test.result.error = undefined
    }
  }

  if (isBrowser && test.result.error)
    console.error(test.result.error.message, test.result.error.stackStr)

  if (isNode) {
    const { getSnapshotClient } = await import('../integrations/snapshot/chai')
    getSnapshotClient().clearTest()
  }

  test.result.duration = now() - start

  if (workerState.config.logHeapUsage && isNode)
    test.result.heap = process.memoryUsage().heapUsed

  workerState.current = undefined

  updateTask(test)
}

function markTasksAsSkipped(suite: Suite) {
  suite.tasks.forEach((t) => {
    t.mode = 'skip'
    t.result = { ...t.result, state: 'skip' }
    updateTask(t)
    if (t.type === 'suite')
      markTasksAsSkipped(t)
  })
}

export async function runSuite(suite: Suite) {
  if (suite.result?.state === 'fail') {
    markTasksAsSkipped(suite)
    updateTask(suite)
    return
  }

  const start = now()

  suite.result = {
    state: 'run',
    startTime: start,
  }

  updateTask(suite)

  const workerState = getWorkerState()

  if (suite.mode === 'skip') {
    suite.result.state = 'skip'
  }
  else if (suite.mode === 'todo') {
    suite.result.state = 'todo'
  }
  else {
    try {
      const beforeAllCleanups = await callSuiteHook(suite, suite, 'beforeAll', [suite])
      if (isBenchmarkMode()) {
        await runBenchmarkSuit(suite)
      }
      else {
        for (let tasksGroup of partitionSuiteChildren(suite)) {
          if (tasksGroup[0].concurrent === true) {
            const mutex = limit(workerState.config.maxConcurrency)
            await Promise.all(tasksGroup.map(c => mutex(() => runSuiteChild(c))))
          }
          else {
            const { sequence } = workerState.config
            if (sequence.shuffle || suite.shuffle) {
              // run describe block independently from tests
              const suites = tasksGroup.filter(group => group.type === 'suite')
              const tests = tasksGroup.filter(group => group.type === 'test')
              const groups = shuffle([suites, tests], sequence.seed)
              tasksGroup = groups.flatMap(group => shuffle(group, sequence.seed))
            }
            for (const c of tasksGroup)
              await runSuiteChild(c)
          }
        }
      }

      await callSuiteHook(suite, suite, 'afterAll', [suite])
      await Promise.all(beforeAllCleanups.map(i => i?.()))
    }
    catch (e) {
      suite.result.state = 'fail'
      suite.result.error = processError(e)
    }
  }
  suite.result.duration = now() - start

  if (workerState.config.logHeapUsage && isNode)
    suite.result.heap = process.memoryUsage().heapUsed

  if (suite.mode === 'run') {
    if (!hasTests(suite)) {
      suite.result.state = 'fail'
      if (!suite.result.error)
        suite.result.error = new Error(`No test found in suite ${suite.name}`)
    }
    else if (hasFailed(suite)) {
      suite.result.state = 'fail'
    }
    else {
      suite.result.state = 'pass'
    }
  }

  updateTask(suite)
}

function createBenchmarkResult(name: string): BenchmarkResult {
  return {
    name,
    count: 0,
    hz: 0,
    rme: 0,
    sampleSize: 0,
    sort: 0,
    max: 0,
    min: 0,
    p75: 0,
    p99: 0,
    p995: 0,
    p999: 0,
  }
}

async function runBenchmarkSuit(suite: Suite) {
  const start = performance.now()

  const benchmarkGroup = []
  const benchmarkSuiteGroup = []
  for (const task of suite.tasks) {
    if (task.type === 'benchmark')
      benchmarkGroup.push(task)
    else if (task.type === 'suite')
      benchmarkSuiteGroup.push(task)
  }

  if (benchmarkSuiteGroup.length)
    await Promise.all(benchmarkSuiteGroup.map(subSuite => runBenchmarkSuit(subSuite)))

  if (benchmarkGroup.length) {
    const benchmarkInstance = await getBenchmarkFactory(suite)
    const defer = createDefer()
    const benchmarkMap: Record<string, Benchmark> = {}
    suite.result = {
      state: 'run',
      startTime: start,
      benchmark: createBenchmarkResult(suite.name),
    }
    updateTask(suite)
    benchmarkGroup.forEach((benchmark) => {
      const benchmarkFn = getFn(benchmark)
      benchmark.result = {
        state: 'run',
        startTime: start,
        benchmark: createBenchmarkResult(benchmark.name),
      }
      benchmarkMap[benchmark.name] = benchmark
      benchmarkInstance.add(benchmark.name, benchmarkFn)
      updateTask(benchmark)
    })
    benchmarkInstance.addEventListener('cycle', (e) => {
      const task = e.task
      const benchmark = benchmarkMap[task.name || '']
      if (benchmark) {
        const taskRes = task.result!
        const result = benchmark.result!.benchmark!
        result.min = taskRes.min
        result.max = taskRes.max
        result.p75 = taskRes.p75
        result.p99 = taskRes.p99
        result.p995 = taskRes.p995
        result.p999 = taskRes.p999
        result.sampleSize = taskRes.samples.length
        result.name = task.name || result.name
        result.count = task.runs || result.count
        result.hz = taskRes.hz || result.hz
        result.rme = taskRes.rme || result.rme
        updateTask(benchmark)
      }
    })
    benchmarkInstance.addEventListener('complete', () => {
      suite.result!.duration = performance.now() - start
      suite.result!.state = 'pass'

      benchmarkInstance.tasks
        .sort((a, b) => b.result!.hz - a.result!.hz)
        .forEach((cycle, idx) => {
          const benchmark = benchmarkMap[cycle.name || '']
          if (benchmark) {
            const result = benchmark.result!.benchmark!
            result.sort = Number(idx) + 1
            updateTask(benchmark)
          }
        })
      updateTask(suite)
      defer.resolve(null)
    })
    benchmarkInstance.addEventListener('error', (e) => {
      defer.reject(e)
    })
    benchmarkInstance.run()
    await defer
  }
}

async function runSuiteChild(c: Task) {
  if (c.type === 'test')
    return runTest(c)

  else if (c.type === 'suite')
    return runSuite(c)
}

async function runSuites(suites: Suite[]) {
  for (const suite of suites)
    await runSuite(suite)
}

export async function runFiles(files: File[], config: ResolvedConfig) {
  for (const file of files) {
    if (!file.tasks.length && !config.passWithNoTests) {
      if (!file.result?.error) {
        file.result = {
          state: 'fail',
          error: new Error(`No test suite found in file ${file.filepath}`),
        }
      }
    }
    await runSuite(file)
  }
}

async function startTestsBrowser(paths: string[], config: ResolvedConfig) {
  if (isNode) {
    rpc().onPathsCollected(paths)
  }
  else {
    const files = await collectTests(paths, config)
    await rpc().onCollected(files)
    await runSuites(files)
    await sendTasksUpdate()
  }
}

async function startTestsNode(paths: string[], config: ResolvedConfig) {
  const files = await collectTests(paths, config)

  rpc().onCollected(files)

  const { getSnapshotClient } = await import('../integrations/snapshot/chai')
  getSnapshotClient().clear()

  await runFiles(files, config)

  const coverage = await takeCoverageInsideWorker(config.coverage)
  rpc().onAfterSuiteRun({ coverage })

  await getSnapshotClient().saveCurrent()

  await sendTasksUpdate()
}

export async function startTests(paths: string[], config: ResolvedConfig) {
  if (config.browser)
    return startTestsBrowser(paths, config)
  else
    return startTestsNode(paths, config)
}

export function clearModuleMocks() {
  const { clearMocks, mockReset, restoreMocks } = getWorkerState().config

  // since each function calls another, we can just call one
  if (restoreMocks)
    vi.restoreAllMocks()
  else if (mockReset)
    vi.resetAllMocks()
  else if (clearMocks)
    vi.clearAllMocks()
}
