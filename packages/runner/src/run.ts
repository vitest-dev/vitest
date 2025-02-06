import type { Awaitable } from '@vitest/utils'
import type { DiffOptions } from '@vitest/utils/diff'
import type { FileSpecification, VitestRunner } from './types/runner'
import type {
  File,
  HookListener,
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
} from './types/tasks'
import { getSafeTimers, shuffle } from '@vitest/utils'
import { processError } from '@vitest/utils/error'
import { collectTests } from './collect'
import { PendingError } from './errors'
import { callFixtureCleanup } from './fixture'
import { getFn, getHooks } from './map'
import { setCurrentTest } from './test-state'
import { limitConcurrency } from './utils/limit-concurrency'
import { partitionSuiteChildren } from './utils/suite'
import { hasFailed, hasTests } from './utils/tasks'

const now = globalThis.performance ? globalThis.performance.now.bind(globalThis.performance) : Date.now
const unixNow = Date.now

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

  const onTestFailed = test.context.onTestFailed
  const onTestFinished = test.context.onTestFinished
  test.context.onTestFailed = () => {
    throw new Error(`Cannot call "onTestFailed" inside a test hook.`)
  }
  test.context.onTestFinished = () => {
    throw new Error(`Cannot call "onTestFinished" inside a test hook.`)
  }

  if (sequence === 'parallel') {
    try {
      await Promise.all(hooks.map(fn => fn(test.context)))
    }
    catch (e) {
      failTask(test.result!, e, runner.config.diffOptions)
    }
  }
  else {
    for (const fn of hooks) {
      try {
        await fn(test.context)
      }
      catch (e) {
        failTask(test.result!, e, runner.config.diffOptions)
      }
    }
  }

  test.context.onTestFailed = onTestFailed
  test.context.onTestFinished = onTestFinished
}

export async function callSuiteHook<T extends keyof SuiteHooks>(
  suite: Suite,
  currentTask: Task,
  name: T,
  runner: VitestRunner,
  args: SuiteHooks[T][0] extends HookListener<infer A, any> ? A : never,
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

  if (sequence === 'parallel') {
    callbacks.push(
      ...(await Promise.all(hooks.map(hook => (hook as any)(...args)))),
    )
  }
  else {
    for (const hook of hooks) {
      callbacks.push(await (hook as any)(...args))
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

const packs = new Map<string, [TaskResult | undefined, TaskMeta]>()
const eventsPacks: [string, TaskUpdateEvent][] = []
let updateTimer: any
let previousUpdate: Promise<void> | undefined

export function updateTask(event: TaskUpdateEvent, task: Task, runner: VitestRunner): void {
  eventsPacks.push([task.id, event])
  packs.set(task.id, [task.result, task.meta])

  const { clearTimeout, setTimeout } = getSafeTimers()

  clearTimeout(updateTimer)
  updateTimer = setTimeout(() => {
    previousUpdate = sendTasksUpdate(runner)
  }, 10)
}

async function sendTasksUpdate(runner: VitestRunner) {
  const { clearTimeout } = getSafeTimers()
  clearTimeout(updateTimer)
  await previousUpdate

  if (packs.size) {
    const taskPacks = Array.from(packs).map<TaskResultPack>(([id, task]) => {
      return [id, task[0], task[1]]
    })
    const p = runner.onTaskUpdate?.(taskPacks, eventsPacks)
    eventsPacks.length = 0
    packs.clear()
    return p
  }
}

async function callCleanupHooks(cleanups: unknown[]) {
  await Promise.all(
    cleanups.map(async (fn) => {
      if (typeof fn !== 'function') {
        return
      }
      await fn()
    }),
  )
}

export async function runTest(test: Test, runner: VitestRunner): Promise<void> {
  await runner.onBeforeRunTask?.(test)

  if (test.mode !== 'run' && test.mode !== 'queued') {
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

  setCurrentTest(test)

  const suite = test.suite || test.file

  const repeats = test.repeats ?? 0
  for (let repeatCount = 0; repeatCount <= repeats; repeatCount++) {
    const retry = test.retry ?? 0
    for (let retryCount = 0; retryCount <= retry; retryCount++) {
      let beforeEachCleanups: unknown[] = []
      try {
        await runner.onBeforeTryTask?.(test, {
          retry: retryCount,
          repeats: repeatCount,
        })

        test.result.repeatCount = repeatCount

        beforeEachCleanups = await callSuiteHook(
          suite,
          test,
          'beforeEach',
          runner,
          [test.context, suite],
        )

        if (runner.runTask) {
          await runner.runTask(test)
        }
        else {
          const fn = getFn(test)
          if (!fn) {
            throw new Error(
              'Test function is not found. Did you add it using `setFn`?',
            )
          }
          await fn()
        }

        await runner.onAfterTryTask?.(test, {
          retry: retryCount,
          repeats: repeatCount,
        })

        if (test.result.state !== 'fail') {
          if (!test.repeats) {
            test.result.state = 'pass'
          }
          else if (test.repeats && retry === retryCount) {
            test.result.state = 'pass'
          }
        }
      }
      catch (e) {
        failTask(test.result, e, runner.config.diffOptions)
      }

      // skipped with new PendingError
      if (test.result?.pending || test.result?.state === 'skip') {
        test.mode = 'skip'
        test.result = { state: 'skip', note: test.result?.note, pending: true }
        updateTask('test-finished', test, runner)
        setCurrentTest(undefined)
        return
      }

      try {
        await runner.onTaskFinished?.(test)
      }
      catch (e) {
        failTask(test.result, e, runner.config.diffOptions)
      }

      try {
        await callSuiteHook(suite, test, 'afterEach', runner, [
          test.context,
          suite,
        ])
        await callCleanupHooks(beforeEachCleanups)
        await callFixtureCleanup(test.context)
      }
      catch (e) {
        failTask(test.result, e, runner.config.diffOptions)
      }

      await callTestHooks(runner, test, test.onFinished || [], 'stack')

      if (test.result.state === 'fail') {
        await callTestHooks(
          runner,
          test,
          test.onFailed || [],
          runner.config.sequence.hooks,
        )
      }

      test.onFailed = undefined
      test.onFinished = undefined

      if (test.result.state === 'pass') {
        break
      }

      if (retryCount < retry) {
        // reset state when retry test
        test.result.state = 'run'
        test.result.retryCount = (test.result.retryCount ?? 0) + 1
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

  result.state = 'fail'
  const errors = Array.isArray(err) ? err : [err]
  for (const e of errors) {
    const error = processError(e, diffOptions)
    result.errors ??= []
    result.errors.push(error)
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
    try {
      try {
        beforeAllCleanups = await callSuiteHook(
          suite,
          suite,
          'beforeAll',
          runner,
          [suite],
        )
      }
      catch (e) {
        markTasksAsSkipped(suite, runner)
        throw e
      }

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
    catch (e) {
      failTask(suite.result, e, runner.config.diffOptions)
    }

    try {
      await callSuiteHook(suite, suite, 'afterAll', runner, [suite])
      await callCleanupHooks(beforeAllCleanups)
    }
    catch (e) {
      failTask(suite.result, e, runner.config.diffOptions)
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

    updateTask('suite-finished', suite, runner)

    await runner.onAfterRunSuite?.(suite)
  }
}

let limitMaxConcurrency: ReturnType<typeof limitConcurrency>

async function runSuiteChild(c: Task, runner: VitestRunner) {
  if (c.type === 'test') {
    return limitMaxConcurrency(() => runTest(c, runner))
  }
  else if (c.type === 'suite') {
    return runSuite(c, runner)
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
    await runSuite(file, runner)
  }
}

export async function startTests(specs: string[] | FileSpecification[], runner: VitestRunner): Promise<File[]> {
  const paths = specs.map(f => typeof f === 'string' ? f : f.filepath)
  await runner.onBeforeCollect?.(paths)

  const files = await collectTests(specs, runner)

  await runner.onCollected?.(files)
  await runner.onBeforeRunFiles?.(files)

  await runFiles(files, runner)

  await runner.onAfterRunFiles?.(files)

  await sendTasksUpdate(runner)

  return files
}

async function publicCollect(specs: string[] | FileSpecification[], runner: VitestRunner): Promise<File[]> {
  const paths = specs.map(f => typeof f === 'string' ? f : f.filepath)

  await runner.onBeforeCollect?.(paths)

  const files = await collectTests(specs, runner)

  await runner.onCollected?.(files)
  return files
}

export { publicCollect as collectTests }
