import limit from 'p-limit'
import { shuffle } from '@vitest/utils'
import type { VitestRunner } from './types/runner'
import type { File, HookCleanupCallback, HookListener, SequenceHooks, Suite, SuiteHooks, Task, TaskResult, TaskState, Test } from './types'
import { partitionSuiteChildren } from './utils/suite'
import { getFn, getHooks } from './map'
import { collectTests } from './collect'
import { processError } from './error'
import { setCurrentTest } from './test-state'
import { hasFailed, hasTests } from './utils/tasks'

const now = Date.now

function updateSuiteHookState(suite: Task, name: keyof SuiteHooks, state: TaskState, runner: VitestRunner) {
  if (!suite.result)
    suite.result = { state: 'run' }
  if (!suite.result?.hooks)
    suite.result.hooks = {}
  const suiteHooks = suite.result.hooks
  if (suiteHooks) {
    suiteHooks[name] = state
    updateTask(suite, runner)
  }
}

function getSuiteHooks(suite: Suite, name: keyof SuiteHooks, sequence: SequenceHooks) {
  const hooks = getHooks(suite)[name]
  if (sequence === 'stack' && (name === 'afterAll' || name === 'afterEach'))
    return hooks.slice().reverse()
  return hooks
}

export async function callSuiteHook<T extends keyof SuiteHooks>(
  suite: Suite,
  currentTask: Task,
  name: T,
  runner: VitestRunner,
  args: SuiteHooks[T][0] extends HookListener<infer A, any> ? A : never,
): Promise<HookCleanupCallback[]> {
  const sequence = runner.config.sequence.hooks

  const callbacks: HookCleanupCallback[] = []
  if (name === 'beforeEach' && suite.suite) {
    callbacks.push(
      ...await callSuiteHook(suite.suite, currentTask, name, runner, args),
    )
  }

  updateSuiteHookState(currentTask, name, 'run', runner)

  const hooks = getSuiteHooks(suite, name, sequence)

  if (sequence === 'parallel') {
    callbacks.push(...await Promise.all(hooks.map(fn => fn(...args as any))))
  }
  else {
    for (const hook of hooks)
      callbacks.push(await hook(...args as any))
  }

  updateSuiteHookState(currentTask, name, 'pass', runner)

  if (name === 'afterEach' && suite.suite) {
    callbacks.push(
      ...await callSuiteHook(suite.suite, currentTask, name, runner, args),
    )
  }

  return callbacks
}

const packs = new Map<string, TaskResult | undefined>()
let updateTimer: any
let previousUpdate: Promise<void> | undefined

function updateTask(task: Task, runner: VitestRunner) {
  packs.set(task.id, task.result)

  clearTimeout(updateTimer)
  updateTimer = setTimeout(() => {
    previousUpdate = sendTasksUpdate(runner)
  }, 10)
}

async function sendTasksUpdate(runner: VitestRunner) {
  clearTimeout(updateTimer)
  await previousUpdate

  if (packs.size) {
    const p = runner.onTaskUpdate?.(Array.from(packs))
    packs.clear()
    return p
  }
}

const callCleanupHooks = async (cleanups: HookCleanupCallback[]) => {
  await Promise.all(cleanups.map(async (fn) => {
    if (typeof fn !== 'function')
      return
    await fn()
  }))
}

export async function runTest(test: Test, runner: VitestRunner) {
  await runner.onBeforeRunTest?.(test)

  if (test.mode !== 'run') {
    // TODO: move to hook
    // const { getSnapshotClient } = await import('../integrations/snapshot/chai')
    // getSnapshotClient().skipTestSnapshots(test)
    return
  }

  if (test.result?.state === 'fail') {
    updateTask(test, runner)
    return
  }

  const start = now()

  test.result = {
    state: 'run',
    startTime: start,
  }
  updateTask(test, runner)

  // TODO: MOVE TO HOOK
  // clearModuleMocks()

  setCurrentTest(test)

  // if (isNode) {
  //   const { getSnapshotClient } = await import('../integrations/snapshot/chai')
  //   await getSnapshotClient().setTest(test)
  // }

  // const workerState = getWorkerState()

  // workerState.current = test

  const retry = test.retry || 1
  for (let retryCount = 0; retryCount < retry; retryCount++) {
    let beforeEachCleanups: HookCleanupCallback[] = []
    try {
      // const state: Partial<MatcherState> = {
      //   assertionCalls: 0,
      //   isExpectingAssertions: false,
      //   isExpectingAssertionsError: null,
      //   expectedAssertionsNumber: null,
      //   expectedAssertionsNumberErrorGen: null,
      //   testPath: test.suite.file?.filepath,
      //   currentTestName: getFullName(test),
      //   // snapshotState: getSnapshotClient().snapshotState,
      // }
      // setState<MatcherState>(
      //   runner.augmentExpectState?.(state) || state,
      //   (globalThis as any)[GLOBAL_EXPECT],
      // )
      await runner.onBeforeTryTest?.(test, retryCount)

      beforeEachCleanups = await callSuiteHook(test.suite, test, 'beforeEach', runner, [test.context, test.suite])

      test.result.retryCount = retryCount

      await getFn(test)()

      await runner.onAfterTryTest?.(test, retryCount)
      // const {
      //   assertionCalls,
      //   expectedAssertionsNumber,
      //   expectedAssertionsNumberErrorGen,
      //   isExpectingAssertions,
      //   isExpectingAssertionsError,
      // } = runner.receiveExpectState?.(test) || getState((globalThis as any)[GLOBAL_EXPECT])
      // if (expectedAssertionsNumber !== null && assertionCalls !== expectedAssertionsNumber)
      //   throw expectedAssertionsNumberErrorGen!()
      // if (isExpectingAssertions === true && assertionCalls === 0)
      //   throw isExpectingAssertionsError

      test.result.state = 'pass'
    }
    catch (e) {
      const error = processError(e)
      test.result.state = 'fail'
      test.result.error = error
      test.result.errors = [error]
    }

    try {
      await callSuiteHook(test.suite, test, 'afterEach', runner, [test.context, test.suite])
      await callCleanupHooks(beforeEachCleanups)
    }
    catch (e) {
      const error = processError(e)
      test.result.state = 'fail'
      test.result.error = error
      test.result.errors = [error]
    }

    if (test.result.state === 'pass')
      break

    // update retry info
    updateTask(test, runner)
  }

  if (test.result.state === 'fail')
    await Promise.all(test.onFailed?.map(fn => fn(test.result!)) || [])

  // if test is marked to be failed, flip the result
  if (test.fails) {
    if (test.result.state === 'pass') {
      const error = processError(new Error('Expect test to fail'))
      test.result.state = 'fail'
      test.result.error = error
      test.result.errors = [error]
    }
    else {
      test.result.state = 'pass'
      test.result.error = undefined
      test.result.errors = undefined
    }
  }

  setCurrentTest(undefined)

  test.result.duration = now() - start

  await runner.onAfterRunTest?.(test)

  // if (isNode) {
  //   const { getSnapshotClient } = await import('../integrations/snapshot/chai')
  //   getSnapshotClient().clearTest()
  // }

  // if (workerState.config.logHeapUsage && isNode)
  //   test.result.heap = process.memoryUsage().heapUsed

  // workerState.current = undefined

  updateTask(test, runner)
}

function markTasksAsSkipped(suite: Suite, runner: VitestRunner) {
  suite.tasks.forEach((t) => {
    t.mode = 'skip'
    t.result = { ...t.result, state: 'skip' }
    updateTask(t, runner)
    if (t.type === 'suite')
      markTasksAsSkipped(t, runner)
  })
}

export async function runSuite(suite: Suite, runner: VitestRunner) {
  await runner.onBeforeRunSuite?.(suite)

  if (suite.result?.state === 'fail') {
    markTasksAsSkipped(suite, runner)
    updateTask(suite, runner)
    return
  }

  const start = now()

  suite.result = {
    state: 'run',
    startTime: start,
  }

  updateTask(suite, runner)

  // const workerState = getWorkerState()

  if (suite.mode === 'skip') {
    suite.result.state = 'skip'
  }
  else if (suite.mode === 'todo') {
    suite.result.state = 'todo'
  }
  else {
    try {
      const beforeAllCleanups = await callSuiteHook(suite, suite, 'beforeAll', runner, [suite])

      for (let tasksGroup of partitionSuiteChildren(suite)) {
        if (tasksGroup[0].concurrent === true) {
          const mutex = limit(runner.config.maxConcurrency)
          await Promise.all(tasksGroup.map(c => mutex(() => runSuiteChild(c, runner))))
        }
        else {
          const { sequence } = runner.config
          if (sequence.shuffle || suite.shuffle) {
            // run describe block independently from tests
            const suites = tasksGroup.filter(group => group.type === 'suite')
            const tests = tasksGroup.filter(group => group.type === 'test')
            const groups = shuffle([suites, tests], sequence.seed)
            tasksGroup = groups.flatMap(group => shuffle(group, sequence.seed))
          }
          for (const c of tasksGroup)
            await runSuiteChild(c, runner)
        }
      }

      await callSuiteHook(suite, suite, 'afterAll', runner, [suite])
      await callCleanupHooks(beforeAllCleanups)
    }
    catch (e) {
      const error = processError(e)
      suite.result.state = 'fail'
      suite.result.error = error
      suite.result.errors = [error]
    }
  }
  suite.result.duration = now() - start

  await runner.onAfterRunSuite?.(suite)

  // if (workerState.config.logHeapUsage && isNode)
  //   suite.result.heap = process.memoryUsage().heapUsed

  if (suite.mode === 'run') {
    if (!hasTests(suite)) {
      suite.result.state = 'fail'
      if (!suite.result.error) {
        const error = processError(new Error(`No test found in suite ${suite.name}`))
        suite.result.error = error
        suite.result.errors = [error]
      }
    }
    else if (hasFailed(suite)) {
      suite.result.state = 'fail'
    }
    else {
      suite.result.state = 'pass'
    }
  }

  updateTask(suite, runner)
}

async function runSuiteChild(c: Task, runner: VitestRunner) {
  if (c.type === 'test')
    return runTest(c, runner)

  else if (c.type === 'suite')
    return runSuite(c, runner)
}

export async function runFiles(files: File[], runner: VitestRunner) {
  for (const file of files) {
    if (!file.tasks.length && !runner.config.passWithNoTests) {
      if (!file.result?.errors?.length) {
        const error = processError(new Error(`No test suite found in file ${file.filepath}`))
        file.result = {
          state: 'fail',
          error,
          errors: [error],
        }
      }
    }
    await runSuite(file, runner)
  }
}

export async function startTests(paths: string[], runner: VitestRunner) {
  await runner.onBeforeCollect?.()

  const files = await collectTests(paths, runner)

  runner.onCollected?.(files)
  // rpc().onCollected(files)

  // const { getSnapshotClient } = await import('../integrations/snapshot/chai')
  // getSnapshotClient().clear()

  await runFiles(files, runner)

  await runner.onAfterRun?.()
  // const coverage = await takeCoverageInsideWorker(config.coverage)
  // rpc().onAfterSuiteRun({ coverage })

  // await getSnapshotClient().saveCurrent()

  await sendTasksUpdate(runner)

  return files
}

// export function clearModuleMocks() {
//   const { clearMocks, mockReset, restoreMocks, unstubEnvs, unstubGlobals } = getWorkerState().config

//   // since each function calls another, we can just call one
//   if (restoreMocks)
//     vi.restoreAllMocks()
//   else if (mockReset)
//     vi.resetAllMocks()
//   else if (clearMocks)
//     vi.clearAllMocks()

//   if (unstubEnvs)
//     vi.unstubAllEnvs()
//   if (unstubGlobals)
//     vi.unstubAllGlobals()
// }
