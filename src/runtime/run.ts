import { performance } from 'perf_hooks'
import { HookListener } from 'vitest'
import { ResolvedConfig, Test, RunnerContext, Suite, SuiteHooks, Task } from '../types'
import { getSnapshotManager } from '../integrations/chai/snapshot'
import { startWatcher } from '../node/watcher'
import { globTestFiles } from '../node/glob'
import { hasFailed, hasTests, partitionSuiteChildren } from '../utils'
import { getFn, getHooks } from './map'
import { collectTests } from './collect'
import { setupRunner } from './setup'

async function callHook<T extends keyof SuiteHooks>(suite: Suite, name: T, args: SuiteHooks[T][0] extends HookListener<infer A> ? A : never) {
  await Promise.all(getHooks(suite)[name].map(fn => fn(...(args as any))))
}

export async function runTest(test: Test, ctx: RunnerContext) {
  if (test.mode !== 'run')
    return

  const { reporter } = ctx

  getSnapshotManager()?.setTest(test)

  await reporter.onTestBegin?.(test, ctx)
  test.result = {
    start: performance.now(),
    state: 'run',
  }

  try {
    await callHook(test.suite, 'beforeEach', [test, test.suite])
    await getFn(test)()
    test.result.state = 'pass'
  }
  catch (e) {
    test.result.state = 'fail'
    test.result.error = e
    process.exitCode = 1
  }
  try {
    await callHook(test.suite, 'afterEach', [test, test.suite])
  }
  catch (e) {
    test.result.state = 'fail'
    test.result.error = e
    process.exitCode = 1
  }

  test.result.end = performance.now()

  await reporter.onTestEnd?.(test, ctx)
}

export async function runSuite(suite: Suite, ctx: RunnerContext) {
  const { reporter } = ctx

  await reporter.onSuiteBegin?.(suite, ctx)

  suite.result = {
    start: performance.now(),
    state: 'run',
  }

  if (suite.mode === 'skip') {
    suite.result.state = 'skip'
  }
  else if (suite.mode === 'todo') {
    suite.result.state = 'todo'
  }
  else {
    try {
      await callHook(suite, 'beforeAll', [suite])

      for (const tasksGroup of partitionSuiteChildren(suite)) {
        const computeMode = tasksGroup[0].computeMode
        if (computeMode === 'serial') {
          for (const c of tasksGroup)
            await runSuiteChild(c, ctx)
        }
        else if (computeMode === 'concurrent') {
          await Promise.all(tasksGroup.map(c => runSuiteChild(c, ctx)))
        }
      }

      await callHook(suite, 'afterAll', [suite])
    }
    catch (e) {
      suite.result.state = 'fail'
      suite.result.error = e
      process.exitCode = 1
    }
  }
  suite.result.end = performance.now()
  if (suite.mode === 'run') {
    if (!hasTests(suite)) {
      suite.result.state = 'fail'
      suite.result.error = new Error(`No tests found in suite ${suite.name}`)
      process.exitCode = 1
    }
    else if (hasFailed(suite)) {
      suite.result.state = 'fail'
    }
  }

  await reporter.onSuiteEnd?.(suite, ctx)
}

async function runSuiteChild(c: Task, ctx: RunnerContext) {
  return c.type === 'test'
    ? runTest(c, ctx)
    : runSuite(c, ctx)
}

export async function runSuites(suites: Suite[], ctx: RunnerContext) {
  for (const suite of suites)
    await runSuite(suite, ctx)
}

export async function run(config: ResolvedConfig) {
  const testFilepaths = await globTestFiles(config)
  if (!testFilepaths.length) {
    console.error('No test files found')
    process.exitCode = 1
    return
  }

  // setup envs
  const ctx = await setupRunner(config)

  const { filesMap, snapshotManager, reporter } = ctx

  await reporter.onStart?.(config)

  const newFileMap = await collectTests(testFilepaths)

  Object.assign(filesMap, newFileMap)
  const files = Object.values(filesMap)

  await reporter.onCollected?.(files, ctx)
  await runSuites(files, ctx)

  snapshotManager.saveSnap()

  await reporter.onFinished?.(ctx)

  if (config.watch)
    await startWatcher(ctx)
}
