import type { Awaitable, TestError } from '@vitest/utils'
import type { DiffOptions } from '@vitest/utils/diff'
import type { FileSpecification, VitestRunner } from './types/runner'
import type {
  AroundEachListener,
  File,
  RegisteredAroundAllListener,
  SequenceHooks,
  Suite,
  SuiteHooks,
  Task,
  TaskMeta,
  TaskResult,
  TaskResultPack,
  TaskState,
  TaskUpdateEvent,
  Test,
  TestContext,
  WriteableTestContext,
} from './types/tasks'
import type { ConcurrencyLimiter } from './utils/limit-concurrency'
import { processError } from '@vitest/utils/error' // TODO: load dynamically
import { shuffle } from '@vitest/utils/helpers'
import { getSafeTimers } from '@vitest/utils/timers'
import { collectTests } from './collect'
import { abortContextSignal } from './context'
import { AroundHookMultipleCallsError, AroundHookSetupError, AroundHookTeardownError, PendingError, TestRunAbortError } from './errors'
import { callFixtureCleanup, callFixtureCleanupFrom, getFixtureCleanupCount, TestFixtures } from './fixture'
import { getAroundHookStackTrace, getAroundHookTimeout, getBeforeHookCleanupCallback } from './hooks'
import { getFn, getHooks } from './map'
import { addRunningTest, getRunningTests, setCurrentTest } from './test-state'
import { limitConcurrency } from './utils/limit-concurrency'
import { partitionSuiteChildren } from './utils/suite'
import { hasFailed, hasTests } from './utils/tasks'

const now = globalThis.performance ? globalThis.performance.now.bind(globalThis.performance) : Date.now
const unixNow = Date.now
const { clearTimeout, setTimeout } = getSafeTimers()
let limitMaxConcurrency: ConcurrencyLimiter

/**
 * Normalizes retry configuration to extract individual values.
 * Handles both number and object forms.
 */
function getRetryCount(retry: number | { count?: number } | undefined): number {
  if (retry === undefined) {
    return 0
  }
  if (typeof retry === 'number') {
    return retry
  }
  return retry.count ?? 0
}

function getRetryDelay(retry: number | { delay?: number } | undefined): number {
  if (retry === undefined) {
    return 0
  }
  if (typeof retry === 'number') {
    return 0
  }
  return retry.delay ?? 0
}

function getRetryCondition(
  retry: number | { condition?: RegExp | ((error: TestError) => boolean) } | undefined,
): RegExp | ((error: TestError) => boolean) | undefined {
  if (retry === undefined) {
    return undefined
  }
  if (typeof retry === 'number') {
    return undefined
  }
  return retry.condition
}

function updateSuiteHookState(
  task: Task,
  name: keyof SuiteHooks,
  state: TaskState,
  runner: VitestRunner,
) {
  if (!task.result) {
    task.result = { state: 'run' }
  }
  if (!task.result.hooks) {
    task.result.hooks = {}
  }
  const suiteHooks = task.result.hooks
  if (suiteHooks) {
    suiteHooks[name] = state

    let event: TaskUpdateEvent = state === 'run' ? 'before-hook-start' : 'before-hook-end'

    if (name === 'afterAll' || name === 'afterEach') {
      event = state === 'run' ? 'after-hook-start' : 'after-hook-end'
    }

    updateTask(
      event,
      task,
      runner,
    )
  }
}

function getSuiteHooks(
  suite: Suite,
  name: keyof SuiteHooks,
  sequence: SequenceHooks,
) {
  const hooks = getHooks(suite)[name]
  if (sequence === 'stack' && (name === 'afterAll' || name === 'afterEach')) {
    return hooks.slice().reverse()
  }
  return hooks
}

async function callTestHooks(
  runner: VitestRunner,
  test: Test,
  hooks: ((context: TestContext) => Awaitable<void>)[],
  sequence: SequenceHooks,
) {
  if (sequence === 'stack') {
    hooks = hooks.slice().reverse()
  }

  if (!hooks.length) {
    return
  }

  const context = test.context as WriteableTestContext

  const onTestFailed = test.context.onTestFailed
  const onTestFinished = test.context.onTestFinished
  context.onTestFailed = () => {
    throw new Error(`Cannot call "onTestFailed" inside a test hook.`)
  }
  context.onTestFinished = () => {
    throw new Error(`Cannot call "onTestFinished" inside a test hook.`)
  }

  if (sequence === 'parallel') {
    try {
      await Promise.all(hooks.map(fn => limitMaxConcurrency(() => fn(test.context))))
    }
    catch (e) {
      failTask(test.result!, e, runner.config.diffOptions)
    }
  }
  else {
    for (const fn of hooks) {
      try {
        await limitMaxConcurrency(() => fn(test.context))
      }
      catch (e) {
        failTask(test.result!, e, runner.config.diffOptions)
      }
    }
  }

  context.onTestFailed = onTestFailed
  context.onTestFinished = onTestFinished
}

export async function callSuiteHook<T extends keyof SuiteHooks>(
  suite: Suite,
  currentTask: Task,
  name: T,
  runner: VitestRunner,
  args: SuiteHooks[T][0] extends (...args: infer A) => Awaitable<any> ? A : never,
): Promise<unknown[]> {
  const sequence = runner.config.sequence.hooks

  const callbacks: unknown[] = []
  // stop at file level
  const parentSuite: Suite | null = 'filepath' in suite ? null : suite.suite || suite.file

  if (name === 'beforeEach' && parentSuite) {
    callbacks.push(
      ...(await callSuiteHook(parentSuite, currentTask, name, runner, args)),
    )
  }

  const hooks = getSuiteHooks(suite, name, sequence)

  if (hooks.length > 0) {
    updateSuiteHookState(currentTask, name, 'run', runner)
  }

  async function runHook(hook: Function) {
    return limitMaxConcurrency(async () => {
      return getBeforeHookCleanupCallback(
        hook,
        await hook(...args),
        name === 'beforeEach' ? args[0] as TestContext : undefined,
      )
    })
  }

  if (sequence === 'parallel') {
    callbacks.push(
      ...(await Promise.all(hooks.map(hook => runHook(hook)))),
    )
  }
  else {
    for (const hook of hooks) {
      callbacks.push(await runHook(hook))
    }
  }

  if (hooks.length > 0) {
    updateSuiteHookState(currentTask, name, 'pass', runner)
  }

  if (name === 'afterEach' && parentSuite) {
    callbacks.push(
      ...(await callSuiteHook(parentSuite, currentTask, name, runner, args)),
    )
  }

  return callbacks
}

function getAroundEachHooks(suite: Suite): AroundEachListener[] {
  const hooks: AroundEachListener[] = []
  const parentSuite: Suite | null = 'filepath' in suite ? null : suite.suite || suite.file
  if (parentSuite) {
    hooks.push(...getAroundEachHooks(parentSuite))
  }
  hooks.push(...getHooks(suite).aroundEach)
  return hooks
}

function getAroundAllHooks(suite: Suite): RegisteredAroundAllListener[] {
  return getHooks(suite).aroundAll
}

interface AroundHooksOptions<THook extends Function> {
  hooks: THook[]
  hookName: 'aroundEach' | 'aroundAll'
  callbackName: 'runTest()' | 'runSuite()'
  onTimeout?: (error: Error) => void
  invokeHook: (hook: THook, use: () => Promise<void>) => Awaitable<unknown>
}

function makeAroundHookTimeoutError(
  hookName: string,
  phase: 'setup' | 'teardown',
  timeout: number,
  stackTraceError?: Error,
) {
  const message = `The ${phase} phase of "${hookName}" hook timed out after ${timeout}ms.`
  const ErrorClass = phase === 'setup' ? AroundHookSetupError : AroundHookTeardownError
  const error = new ErrorClass(message)
  if (stackTraceError?.stack) {
    error.stack = stackTraceError.stack.replace(stackTraceError.message, error.message)
  }
  return error
}

async function callAroundHooks<THook extends Function>(
  runInner: () => Promise<void>,
  options: AroundHooksOptions<THook>,
): Promise<void> {
  const { hooks, hookName, callbackName, onTimeout, invokeHook } = options

  if (!hooks.length) {
    await runInner()
    return
  }

  const hookErrors: unknown[] = []

  const createTimeoutPromise = (
    timeout: number,
    phase: 'setup' | 'teardown',
    stackTraceError: Error | undefined,
  ): { promise: Promise<never>; isTimedOut: () => boolean; clear: () => void } => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let timedout = false

    const promise = new Promise<never>((_, reject) => {
      if (timeout > 0 && timeout !== Number.POSITIVE_INFINITY) {
        timer = setTimeout(() => {
          timedout = true
          const error = makeAroundHookTimeoutError(hookName, phase, timeout, stackTraceError)
          onTimeout?.(error)
          reject(error)
        }, timeout)
        timer.unref?.()
      }
    })

    const clear = () => {
      if (timer) {
        clearTimeout(timer)
        timer = undefined
      }
    }

    return { promise, clear, isTimedOut: () => timedout }
  }

  const runNextHook = async (index: number): Promise<void> => {
    if (index >= hooks.length) {
      return runInner()
    }

    const hook = hooks[index]
    const timeout = getAroundHookTimeout(hook)
    const stackTraceError = getAroundHookStackTrace(hook)

    let useCalled = false
    let setupTimeout: ReturnType<typeof createTimeoutPromise>
    let teardownTimeout: ReturnType<typeof createTimeoutPromise> | undefined
    let setupLimitConcurrencyRelease: (() => void) | undefined
    let teardownLimitConcurrencyRelease: (() => void) | undefined

    // Promise that resolves when use() is called (setup phase complete)
    let resolveUseCalled!: () => void
    const useCalledPromise = new Promise<void>((resolve) => {
      resolveUseCalled = resolve
    })

    // Promise that resolves when use() returns (inner hooks complete, teardown phase starts)
    let resolveUseReturned!: () => void
    const useReturnedPromise = new Promise<void>((resolve) => {
      resolveUseReturned = resolve
    })

    // Promise that resolves when hook completes
    let resolveHookComplete!: () => void
    let rejectHookComplete!: (error: Error) => void
    const hookCompletePromise = new Promise<void>((resolve, reject) => {
      resolveHookComplete = resolve
      rejectHookComplete = reject
    })

    const use = async () => {
      // shouldn't continue to next (runTest/Suite or inner aroundEach/All) when aroundEach/All setup timed out.
      if (setupTimeout.isTimedOut()) {
        // we can throw any error to bail out.
        // this error is not seen by end users since `runNextHook` already rejected with timeout error
        // and this error is caught by `rejectHookComplete`.
        throw new Error('__VITEST_INTERNAL_AROUND_HOOK_ABORT__')
      }

      if (useCalled) {
        throw new AroundHookMultipleCallsError(
          `The \`${callbackName}\` callback was called multiple times in the \`${hookName}\` hook. `
          + `The callback can only be called once per hook.`,
        )
      }
      useCalled = true
      resolveUseCalled()

      // Setup phase completed - clear setup timer
      setupTimeout.clear()
      setupLimitConcurrencyRelease?.()

      // Run inner hooks - don't time this against our teardown timeout
      await runNextHook(index + 1).catch(e => hookErrors.push(e))

      teardownLimitConcurrencyRelease = await limitMaxConcurrency.acquire()

      // Start teardown timer after inner hooks complete - only times this hook's teardown code
      teardownTimeout = createTimeoutPromise(timeout, 'teardown', stackTraceError)

      // Signal that use() is returning (teardown phase starting)
      resolveUseReturned()
    }

    setupLimitConcurrencyRelease = await limitMaxConcurrency.acquire()

    // Start setup timeout
    setupTimeout = createTimeoutPromise(timeout, 'setup', stackTraceError)

    // Run the hook in the background
    ;(async () => {
      try {
        await invokeHook(hook, use)
        if (!useCalled) {
          throw new AroundHookSetupError(
            `The \`${callbackName}\` callback was not called in the \`${hookName}\` hook. `
            + `Make sure to call \`${callbackName}\` to run the ${hookName === 'aroundEach' ? 'test' : 'suite'}.`,
          )
        }
        resolveHookComplete()
      }
      catch (error) {
        rejectHookComplete(error as Error)
      }
      finally {
        setupLimitConcurrencyRelease?.()
        teardownLimitConcurrencyRelease?.()
      }
    })()

    // Wait for either: use() to be called OR hook to complete (error) OR setup timeout
    try {
      await Promise.race([
        useCalledPromise,
        hookCompletePromise,
        setupTimeout.promise,
      ])
    }
    finally {
      setupLimitConcurrencyRelease?.()
      setupTimeout.clear()
    }

    // Wait for use() to return (inner hooks complete) OR hook to complete (error during inner hooks)
    await Promise.race([
      useReturnedPromise,
      hookCompletePromise,
    ])

    // Now teardownTimeout is guaranteed to be set
    // Wait for hook to complete (teardown) OR teardown timeout
    try {
      await Promise.race([
        hookCompletePromise,
        teardownTimeout?.promise,
      ])
    }
    finally {
      teardownLimitConcurrencyRelease?.()
      teardownTimeout?.clear()
    }
  }

  await runNextHook(0).catch(e => hookErrors.push(e))

  if (hookErrors.length > 0) {
    throw hookErrors
  }
}

async function callAroundAllHooks(
  suite: Suite,
  runSuiteInner: () => Promise<void>,
): Promise<void> {
  await callAroundHooks(runSuiteInner, {
    hooks: getAroundAllHooks(suite),
    hookName: 'aroundAll',
    callbackName: 'runSuite()',
    invokeHook: (hook, use) => hook(use, suite),
  })
}

async function callAroundEachHooks(
  suite: Suite,
  test: Test,
  runTest: (fixtureCheckpoint: number) => Promise<void>,
): Promise<void> {
  await callAroundHooks(
    // Take checkpoint right before runTest - at this point all aroundEach fixtures
    // have been resolved, so we can correctly identify which fixtures belong to
    // aroundEach (before checkpoint) vs inside runTest (after checkpoint)
    () => runTest(getFixtureCleanupCount(test.context)),
    {
      hooks: getAroundEachHooks(suite),
      hookName: 'aroundEach',
      callbackName: 'runTest()',
      onTimeout: error => abortContextSignal(test.context, error),
      invokeHook: (hook, use) => hook(use, test.context, suite),
    },
  )
}

const packs = new Map<string, [TaskResult | undefined, TaskMeta]>()
const eventsPacks: [string, TaskUpdateEvent, undefined][] = []
const pendingTasksUpdates: Promise<void>[] = []

function sendTasksUpdate(runner: VitestRunner): void {
  if (packs.size) {
    const taskPacks = Array.from(packs).map<TaskResultPack>(([id, task]) => {
      return [id, task[0], task[1]]
    })
    const p = runner.onTaskUpdate?.(taskPacks, eventsPacks)
    if (p) {
      pendingTasksUpdates.push(p)
      // remove successful promise to not grow array indefnitely,
      // but keep rejections so finishSendTasksUpdate can handle them
      p.then(
        () => pendingTasksUpdates.splice(pendingTasksUpdates.indexOf(p), 1),
        () => {},
      )
    }
    eventsPacks.length = 0
    packs.clear()
  }
}

export async function finishSendTasksUpdate(runner: VitestRunner): Promise<void> {
  sendTasksUpdate(runner)
  await Promise.all(pendingTasksUpdates)
}

function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let last = 0
  let pendingCall: ReturnType<typeof setTimeout> | undefined

  return function call(this: any, ...args: any[]) {
    const now = unixNow()
    if (now - last > ms) {
      last = now

      clearTimeout(pendingCall)
      pendingCall = undefined

      return fn.apply(this, args)
    }

    // Make sure fn is still called even if there are no further calls
    pendingCall ??= setTimeout(() => call.bind(this)(...args), ms)
  } as any
}

// throttle based on summary reporter's DURATION_UPDATE_INTERVAL_MS
const sendTasksUpdateThrottled = throttle(sendTasksUpdate, 100)

export function updateTask(event: TaskUpdateEvent, task: Task, runner: VitestRunner): void {
  eventsPacks.push([task.id, event, undefined])
  packs.set(task.id, [task.result, task.meta])
  sendTasksUpdateThrottled(runner)
}

async function callCleanupHooks(runner: VitestRunner, cleanups: unknown[]) {
  const sequence = runner.config.sequence.hooks

  if (sequence === 'stack') {
    cleanups = cleanups.slice().reverse()
  }

  if (sequence === 'parallel') {
    await Promise.all(
      cleanups.map(async (fn) => {
        if (typeof fn !== 'function') {
          return
        }
        await limitMaxConcurrency(() => fn())
      }),
    )
  }
  else {
    for (const fn of cleanups) {
      if (typeof fn !== 'function') {
        continue
      }
      await limitMaxConcurrency(() => fn())
    }
  }
}

/**
 * Determines if a test should be retried based on its retryCondition configuration
 */
function passesRetryCondition(test: Test, errors: TestError[] | undefined): boolean {
  const condition = getRetryCondition(test.retry)

  if (!errors || errors.length === 0) {
    return false
  }

  if (!condition) {
    return true
  }

  const error = errors[errors.length - 1]

  if (condition instanceof RegExp) {
    return condition.test(error.message || '')
  }
  else if (typeof condition === 'function') {
    return condition(error)
  }

  return false
}

export async function runTest(test: Test, runner: VitestRunner): Promise<void> {
  await runner.onBeforeRunTask?.(test)

  if (test.mode !== 'run' && test.mode !== 'queued') {
    updateTask('test-prepare', test, runner)
    updateTask('test-finished', test, runner)
    return
  }

  if (test.result?.state === 'fail') {
    // should not be possible to get here, I think this is just copy pasted from suite
    // TODO: maybe someone fails tests in `beforeAll` hooks?
    // https://github.com/vitest-dev/vitest/pull/7069
    updateTask('test-failed-early', test, runner)
    return
  }

  const start = now()

  test.result = {
    state: 'run',
    startTime: unixNow(),
    retryCount: 0,
  }
  updateTask('test-prepare', test, runner)

  const cleanupRunningTest = addRunningTest(test)
  setCurrentTest(test)

  const suite = test.suite || test.file
  const $ = runner.trace!

  const repeats = test.repeats ?? 0
  for (let repeatCount = 0; repeatCount <= repeats; repeatCount++) {
    const retry = getRetryCount(test.retry)
    for (let retryCount = 0; retryCount <= retry; retryCount++) {
      let beforeEachCleanups: unknown[] = []
      // fixtureCheckpoint is passed by callAroundEachHooks - it represents the count
      // of fixture cleanup functions AFTER all aroundEach fixtures have been resolved
      // but BEFORE the test runs. This allows us to clean up only fixtures created
      // inside runTest while preserving aroundEach fixtures for teardown.
      await callAroundEachHooks(suite, test, async (fixtureCheckpoint) => {
        try {
          await runner.onBeforeTryTask?.(test, {
            retry: retryCount,
            repeats: repeatCount,
          })

          test.result!.repeatCount = repeatCount

          beforeEachCleanups = await $('test.beforeEach', () => callSuiteHook(
            suite,
            test,
            'beforeEach',
            runner,
            [test.context, suite],
          ))

          if (runner.runTask) {
            await $('test.callback', () => limitMaxConcurrency(() => runner.runTask!(test)))
          }
          else {
            const fn = getFn(test)
            if (!fn) {
              throw new Error(
                'Test function is not found. Did you add it using `setFn`?',
              )
            }
            await $('test.callback', () => limitMaxConcurrency(() => fn()))
          }

          await runner.onAfterTryTask?.(test, {
            retry: retryCount,
            repeats: repeatCount,
          })

          if (test.result!.state !== 'fail') {
            test.result!.state = 'pass'
          }
        }
        catch (e) {
          failTask(test.result!, e, runner.config.diffOptions)
        }

        try {
          await runner.onTaskFinished?.(test)
        }
        catch (e) {
          failTask(test.result!, e, runner.config.diffOptions)
        }

        try {
          await $('test.afterEach', () => callSuiteHook(suite, test, 'afterEach', runner, [
            test.context,
            suite,
          ]))
          if (beforeEachCleanups.length) {
            await $('test.cleanup', () => callCleanupHooks(runner, beforeEachCleanups))
          }
          // Only clean up fixtures created inside runTest (after the checkpoint)
          // Fixtures created for aroundEach will be cleaned up after aroundEach teardown
          await callFixtureCleanupFrom(test.context, fixtureCheckpoint)
        }
        catch (e) {
          failTask(test.result!, e, runner.config.diffOptions)
        }

        if (test.onFinished?.length) {
          await $('test.onFinished', () => callTestHooks(runner, test, test.onFinished!, 'stack'))
        }

        if (test.result!.state === 'fail' && test.onFailed?.length) {
          await $('test.onFailed', () => callTestHooks(
            runner,
            test,
            test.onFailed!,
            runner.config.sequence.hooks,
          ))
        }

        test.onFailed = undefined
        test.onFinished = undefined

        await runner.onAfterRetryTask?.(test, {
          retry: retryCount,
          repeats: repeatCount,
        })
      }).catch((error) => {
        failTask(test.result!, error, runner.config.diffOptions)
      })

      // Clean up fixtures that were created for aroundEach (before the checkpoint)
      // This runs after aroundEach teardown has completed
      try {
        await callFixtureCleanup(test.context)
      }
      catch (e) {
        failTask(test.result!, e, runner.config.diffOptions)
      }

      // skipped with new PendingError
      if (test.result?.pending || test.result?.state === 'skip') {
        test.mode = 'skip'
        test.result = {
          state: 'skip',
          note: test.result?.note,
          pending: true,
          duration: now() - start,
        }
        updateTask('test-finished', test, runner)
        setCurrentTest(undefined)
        cleanupRunningTest()
        return
      }

      if (test.result.state === 'pass') {
        break
      }

      if (retryCount < retry) {
        const shouldRetry = passesRetryCondition(test, test.result.errors)

        if (!shouldRetry) {
          break
        }

        test.result.state = 'run'
        test.result.retryCount = (test.result.retryCount ?? 0) + 1

        const delay = getRetryDelay(test.retry)
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      // update retry info
      updateTask('test-retried', test, runner)
    }
  }

  // if test is marked to be failed, flip the result
  if (test.fails) {
    if (test.result.state === 'pass') {
      const error = processError(new Error('Expect test to fail'))
      test.result.state = 'fail'
      test.result.errors = [error]
    }
    else {
      test.result.state = 'pass'
      test.result.errors = undefined
    }
  }

  cleanupRunningTest()
  setCurrentTest(undefined)

  test.result.duration = now() - start

  await runner.onAfterRunTask?.(test)

  updateTask('test-finished', test, runner)
}

function failTask(result: TaskResult, err: unknown, diffOptions: DiffOptions | undefined) {
  if (err instanceof PendingError) {
    result.state = 'skip'
    result.note = err.note
    result.pending = true
    return
  }

  if (err instanceof TestRunAbortError) {
    result.state = 'skip'
    result.note = err.message
    return
  }

  result.state = 'fail'
  const errors = Array.isArray(err) ? err : [err]
  for (const e of errors) {
    const errors = e instanceof AggregateError
      ? e.errors.map(e => processError(e, diffOptions))
      : [processError(e, diffOptions)]
    result.errors ??= []
    result.errors.push(...errors)
  }
}

function markTasksAsSkipped(suite: Suite, runner: VitestRunner) {
  suite.tasks.forEach((t) => {
    t.mode = 'skip'
    t.result = { ...t.result, state: 'skip' }
    updateTask('test-finished', t, runner)
    if (t.type === 'suite') {
      markTasksAsSkipped(t, runner)
    }
  })
}

function markPendingTasksAsSkipped(suite: Suite, runner: VitestRunner, note?: string) {
  suite.tasks.forEach((t) => {
    if (!t.result || t.result.state === 'run') {
      t.mode = 'skip'
      t.result = { ...t.result, state: 'skip', note }
      updateTask('test-cancel', t, runner)
    }

    if (t.type === 'suite') {
      markPendingTasksAsSkipped(t, runner, note)
    }
  })
}

export async function runSuite(suite: Suite, runner: VitestRunner): Promise<void> {
  await runner.onBeforeRunSuite?.(suite)

  if (suite.result?.state === 'fail') {
    markTasksAsSkipped(suite, runner)
    // failed during collection
    updateTask('suite-failed-early', suite, runner)
    return
  }

  const start = now()

  const mode = suite.mode

  suite.result = {
    state: mode === 'skip' || mode === 'todo' ? mode : 'run',
    startTime: unixNow(),
  }
  const $ = runner.trace!

  updateTask('suite-prepare', suite, runner)

  let beforeAllCleanups: unknown[] = []

  if (suite.mode === 'skip') {
    suite.result.state = 'skip'

    updateTask('suite-finished', suite, runner)
  }
  else if (suite.mode === 'todo') {
    suite.result.state = 'todo'

    updateTask('suite-finished', suite, runner)
  }
  else {
    let suiteRan = false

    try {
      await callAroundAllHooks(suite, async () => {
        suiteRan = true
        try {
          // beforeAll
          try {
            beforeAllCleanups = await $('suite.beforeAll', () => callSuiteHook(
              suite,
              suite,
              'beforeAll',
              runner,
              [suite],
            ))
          }
          catch (e) {
            failTask(suite.result!, e, runner.config.diffOptions)
            markTasksAsSkipped(suite, runner)
            return
          }

          // run suite children
          if (runner.runSuite) {
            await runner.runSuite(suite)
          }
          else {
            for (let tasksGroup of partitionSuiteChildren(suite)) {
              if (tasksGroup[0].concurrent === true) {
                await Promise.all(tasksGroup.map(c => runSuiteChild(c, runner)))
              }
              else {
                const { sequence } = runner.config
                if (suite.shuffle) {
                  // run describe block independently from tests
                  const suites = tasksGroup.filter(
                    group => group.type === 'suite',
                  )
                  const tests = tasksGroup.filter(group => group.type === 'test')
                  const groups = shuffle<Task[]>([suites, tests], sequence.seed)
                  tasksGroup = groups.flatMap(group =>
                    shuffle(group, sequence.seed),
                  )
                }
                for (const c of tasksGroup) {
                  await runSuiteChild(c, runner)
                }
              }
            }
          }
        }
        finally {
          // afterAll runs even if beforeAll or suite children fail
          try {
            await $('suite.afterAll', () => callSuiteHook(suite, suite, 'afterAll', runner, [suite]))
            if (beforeAllCleanups.length) {
              await $('suite.cleanup', () => callCleanupHooks(runner, beforeAllCleanups))
            }
            if (suite.file === suite) {
              const contexts = TestFixtures.getFileContexts(suite.file)
              await Promise.all(contexts.map(context => callFixtureCleanup(context)))
            }
          }
          catch (e) {
            failTask(suite.result!, e, runner.config.diffOptions)
          }
        }
      })
    }
    catch (e) {
      // mark tasks as skipped if aroundAll failed before the suite callback was executed
      if (!suiteRan) {
        markTasksAsSkipped(suite, runner)
      }
      failTask(suite.result!, e, runner.config.diffOptions)
    }

    if (suite.mode === 'run' || suite.mode === 'queued') {
      if (!runner.config.passWithNoTests && !hasTests(suite)) {
        suite.result.state = 'fail'
        if (!suite.result.errors?.length) {
          const error = processError(
            new Error(`No test found in suite ${suite.name}`),
          )
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

    suite.result.duration = now() - start

    await runner.onAfterRunSuite?.(suite)

    updateTask('suite-finished', suite, runner)
  }
}

async function runSuiteChild(c: Task, runner: VitestRunner) {
  const $ = runner.trace!
  if (c.type === 'test') {
    return $(
      'run.test',
      {
        'vitest.test.id': c.id,
        'vitest.test.name': c.name,
        'vitest.test.mode': c.mode,
        'vitest.test.timeout': c.timeout,
        'code.file.path': c.file.filepath,
        'code.line.number': c.location?.line,
        'code.column.number': c.location?.column,
      },
      () => runTest(c, runner),
    )
  }
  else if (c.type === 'suite') {
    return $(
      'run.suite',
      {
        'vitest.suite.id': c.id,
        'vitest.suite.name': c.name,
        'vitest.suite.mode': c.mode,
        'code.file.path': c.file.filepath,
        'code.line.number': c.location?.line,
        'code.column.number': c.location?.column,
      },
      () => runSuite(c, runner),
    )
  }
}

export async function runFiles(files: File[], runner: VitestRunner): Promise<void> {
  limitMaxConcurrency ??= limitConcurrency(runner.config.maxConcurrency)

  for (const file of files) {
    if (!file.tasks.length && !runner.config.passWithNoTests) {
      if (!file.result?.errors?.length) {
        const error = processError(
          new Error(`No test suite found in file ${file.filepath}`),
        )
        file.result = {
          state: 'fail',
          errors: [error],
        }
      }
    }
    await runner.trace!(
      'run.spec',
      {
        'code.file.path': file.filepath,
        'vitest.suite.tasks.length': file.tasks.length,
      },
      () => runSuite(file, runner),
    )
  }
}

const workerRunners = new WeakSet<VitestRunner>()

function defaultTrace<T>(_: string, attributes: any, cb?: () => T): T {
  if (typeof attributes === 'function') {
    return attributes() as T
  }
  return cb!()
}

export async function startTests(specs: string[] | FileSpecification[], runner: VitestRunner): Promise<File[]> {
  runner.trace ??= defaultTrace
  const cancel = runner.cancel?.bind(runner)
  // Ideally, we need to have an event listener for this, but only have a runner here.
  // Adding another onCancel felt wrong (maybe it needs to be refactored)
  runner.cancel = (reason) => {
    // We intentionally create only one error since there is only one test run that can be cancelled
    const error = new TestRunAbortError('The test run was aborted by the user.', reason)
    getRunningTests().forEach((test) => {
      abortContextSignal(test.context, error)
      markPendingTasksAsSkipped(test.file, runner, error.message)
    },
    )
    return cancel?.(reason)
  }

  if (!workerRunners.has(runner)) {
    runner.onCleanupWorkerContext?.(async () => {
      await Promise.all(
        [...TestFixtures.getWorkerContexts()].map(context => callFixtureCleanup(context)),
      ).finally(() => {
        TestFixtures.clearDefinitions()
      })
    })
    workerRunners.add(runner)
  }

  try {
    const paths = specs.map(f => typeof f === 'string' ? f : f.filepath)
    await runner.onBeforeCollect?.(paths)

    const files = await collectTests(specs, runner)

    await runner.onCollected?.(files)
    await runner.onBeforeRunFiles?.(files)

    await runFiles(files, runner)

    await runner.onAfterRunFiles?.(files)

    await finishSendTasksUpdate(runner)

    return files
  }
  finally {
    runner.cancel = cancel
  }
}

async function publicCollect(specs: string[] | FileSpecification[], runner: VitestRunner): Promise<File[]> {
  runner.trace ??= defaultTrace

  const paths = specs.map(f => typeof f === 'string' ? f : f.filepath)

  await runner.onBeforeCollect?.(paths)

  const files = await collectTests(specs, runner)

  await runner.onCollected?.(files)
  return files
}

export { publicCollect as collectTests }
