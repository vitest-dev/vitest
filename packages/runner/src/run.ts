import limit from 'p-limit'
import { getSafeTimers, shuffle } from '@vitest/utils'
import { processError } from '@vitest/utils/error'
import type { DiffOptions } from '@vitest/utils/diff'
import type { VitestRunner } from './types/runner'
import type { Custom, File, HookCleanupCallback, HookListener, SequenceHooks, Suite, SuiteHooks, Task, TaskMeta, TaskResult, TaskResultPack, TaskState, Test } from './types'
import { partitionSuiteChildren } from './utils/suite'
import { getFn, getHooks } from './map'
import { collectTests } from './collect'
import { setCurrentTest } from './test-state'
import { hasFailed, hasTests } from './utils/tasks'
import { PendingError } from './errors'
import { callFixtureCleanup } from './fixture'

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

const packs = new Map<string, [TaskResult | undefined, TaskMeta]>()
let updateTimer: any
let previousUpdate: Promise<void> | undefined

export function updateTask(task: Task, runner: VitestRunner) {
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
      return [
        id,
        task[0],
        task[1],
      ]
    })
    const p = runner.onTaskUpdate?.(taskPacks)
    packs.clear()
    return p
  }
}

async function callCleanupHooks(cleanups: HookCleanupCallback[]) {
  await Promise.all(cleanups.map(async (fn) => {
    if (typeof fn !== 'function')
      return
    await fn()
  }))
}

export async function runTest(test: Test | Custom, runner: VitestRunner) {
  await runner.onBeforeRunTask?.(test)

  if (test.mode !== 'run')
    return

  if (test.result?.state === 'fail') {
    updateTask(test, runner)
    return
  }

  const start = now()

  test.result = {
    state: 'run',
    startTime: start,
    retryCount: 0,
  }
  updateTask(test, runner)

  setCurrentTest(test)

  const repeats = test.repeats ?? 0
  for (let repeatCount = 0; repeatCount <= repeats; repeatCount++) {
    const retry = test.retry ?? 0
    for (let retryCount = 0; retryCount <= retry; retryCount++) {
      let beforeEachCleanups: HookCleanupCallback[] = []
      try {
        await runner.onBeforeTryTask?.(test, { retry: retryCount, repeats: repeatCount })

        test.result.repeatCount = repeatCount

        beforeEachCleanups = await callSuiteHook(test.suite, test, 'beforeEach', runner, [test.context, test.suite])

        if (runner.runTask) {
          await runner.runTask(test)
        }
        else {
          const fn = getFn(test)
          if (!fn)
            throw new Error('Test function is not found. Did you add it using `setFn`?')
          await fn()
        }
        // some async expect will be added to this array, in case user forget to await theme
        if (test.promises) {
          const result = await Promise.allSettled(test.promises)
          const errors = result.map(r => r.status === 'rejected' ? r.reason : undefined).filter(Boolean)
          if (errors.length)
            throw errors
        }

        await runner.onAfterTryTask?.(test, { retry: retryCount, repeats: repeatCount })

        if (test.result.state !== 'fail') {
          if (!test.repeats)
            test.result.state = 'pass'
          else if (test.repeats && retry === retryCount)
            test.result.state = 'pass'
        }
      }
      catch (e) {
        failTask(test.result, e, runner.config.diffOptions)
      }

      // skipped with new PendingError
      if (test.pending || test.result?.state === 'skip') {
        test.mode = 'skip'
        test.result = { state: 'skip' }
        updateTask(test, runner)
        setCurrentTest(undefined)
        return
      }

      try {
        await callSuiteHook(test.suite, test, 'afterEach', runner, [test.context, test.suite])
        await callCleanupHooks(beforeEachCleanups)
        await callFixtureCleanup(test.context)
      }
      catch (e) {
        failTask(test.result, e, runner.config.diffOptions)
      }

      if (test.result.state === 'pass')
        break

      if (retryCount < retry) {
        // reset state when retry test
        test.result.state = 'run'
        test.result.retryCount = (test.result.retryCount ?? 0) + 1
      }

      // update retry info
      updateTask(test, runner)
    }
  }

  if (test.result.state === 'fail')
    await Promise.all(test.onFailed?.map(fn => fn(test.result!)) || [])

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

  updateTask(test, runner)
}

function failTask(result: TaskResult, err: unknown, diffOptions?: DiffOptions) {
  if (err instanceof PendingError) {
    result.state = 'skip'
    return
  }

  result.state = 'fail'
  const errors = Array.isArray(err)
    ? err
    : [err]
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

  let beforeAllCleanups: HookCleanupCallback[] = []

  if (suite.mode === 'skip') {
    suite.result.state = 'skip'
  }
  else if (suite.mode === 'todo') {
    suite.result.state = 'todo'
  }
  else {
    try {
      beforeAllCleanups = await callSuiteHook(suite, suite, 'beforeAll', runner, [suite])

      if (runner.runSuite) {
        await runner.runSuite(suite)
      }
      else {
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

    if (suite.mode === 'run') {
      if (!runner.config.passWithNoTests && !hasTests(suite)) {
        suite.result.state = 'fail'
        if (!suite.result.errors?.length) {
          const error = processError(new Error(`No test found in suite ${suite.name}`))
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

    suite.result.duration = now() - start

    await runner.onAfterRunSuite?.(suite)
  }
}

async function runSuiteChild(c: Task, runner: VitestRunner) {
  if (c.type === 'test' || c.type === 'custom')
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
          errors: [error],
        }
      }
    }
    await runSuite(file, runner)
  }
}

export async function startTests(paths: string[], runner: VitestRunner) {
  await runner.onBeforeCollect?.(paths)

  const files = await collectTests(paths, runner)

  runner.onCollected?.(files)
  await runner.onBeforeRunFiles?.(files)

  await runFiles(files, runner)

  await runner.onAfterRunFiles?.(files)

  await sendTasksUpdate(runner)

  return files
}
