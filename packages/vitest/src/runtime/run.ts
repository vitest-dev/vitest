import { performance } from 'perf_hooks'
import type { Benchmark, File, HookCleanupCallback, HookListener, ResolvedConfig, Suite, SuiteHooks, Task, TaskResult, TaskState, Test } from '../types'
import { vi } from '../integrations/vi'
import { getSnapshotClient } from '../integrations/snapshot/chai'
import { clearTimeout, getFullName, getWorkerState, hasFailed, hasTests, partitionSuiteChildren, setTimeout } from '../utils'
import { getState, setState } from '../integrations/chai/jest-expect'
import { takeCoverage } from '../integrations/coverage'
import { getFn, getHooks } from './map'
import { rpc } from './rpc'
import { collectTests } from './collect'
import { processError } from './error'
import { getBenchmark } from './benchmark'

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
  if (test.mode !== 'run')
    return

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

  await getSnapshotClient().setTest(test)

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
    })
    await getFn(test)()
    const { assertionCalls, expectedAssertionsNumber, expectedAssertionsNumberErrorGen, isExpectingAssertions, isExpectingAssertionsError } = getState()
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

  getSnapshotClient().clearTest()

  test.result.duration = now() - start

  if (workerState.config.logHeapUsage)
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

  if (suite.mode === 'skip') {
    suite.result.state = 'skip'
  }
  else if (suite.mode === 'todo') {
    suite.result.state = 'todo'
  }
  else {
    try {
      const beforeAllCleanups = await callSuiteHook(suite, suite, 'beforeAll', [suite])

      for (const tasksGroup of partitionSuiteChildren(suite)) {
        if (tasksGroup[0].concurrent === true) {
          await Promise.all(tasksGroup.map(c => runSuiteChild(c)))
        }
        else {
          for (const c of tasksGroup)
            await runSuiteChild(c)
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

  const workerState = getWorkerState()

  if (workerState.config.logHeapUsage)
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

async function runBenchmark(benchmark: Benchmark) {
  const start = performance.now()

  benchmark.result = {
    state: 'run',
    startTime: start,
    cycle: [],
    complete: {
      fastest: '',
    },
  }
  updateTask(benchmark)

  const benchmarkLib = getBenchmark(benchmark)
  benchmarkLib.on('cycle', (e: any) => {
    const cycle = e.target
    benchmark.result!.cycle.push({
      name: cycle.name,
      count: cycle.count,
      cycles: cycle.cycles,
      hz: cycle.hz,
      rme: cycle.stats.rme,
      sampleSize: cycle.stats.sample.length,
    })
    updateTask(benchmark)
  })
  benchmarkLib.on('complete', () => {
    benchmark.result!.complete = {
      fastest: benchmarkLib.filter('fastest').map('name')[0],
    }
    updateTask(benchmark)
  })
  benchmarkLib.run()
  benchmark.result.duration = performance.now() - start
  benchmark.result.state = 'pass'
  updateTask(benchmark)
}

async function runSuiteChild(c: Task) {
  if (c.type === 'test')
    return runTest(c)
  else if (c.type === 'suite')
    return runSuite(c)
  else if (c.type === 'benchmark')
    return runBenchmark(c)
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

export async function startTests(paths: string[], config: ResolvedConfig) {
  const files = await collectTests(paths, config)

  rpc().onCollected(files)
  getSnapshotClient().clear()

  await runFiles(files, config)

  takeCoverage()

  await getSnapshotClient().saveCurrent()

  await sendTasksUpdate()
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
