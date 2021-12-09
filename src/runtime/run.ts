import { performance } from 'perf_hooks'
import { HookListener } from 'vitest'
import { Test, Suite, SuiteHooks, Task } from '../types'
import { getSnapshotManager } from '../integrations/chai/snapshot'
import { hasFailed, hasTests, partitionSuiteChildren } from '../utils'
import { getFn, getHooks } from './map'
import { rpc } from './rpc'
import { collectTests } from './collect'

async function callHook<T extends keyof SuiteHooks>(suite: Suite, name: T, args: SuiteHooks[T][0] extends HookListener<infer A> ? A : never) {
  await Promise.all(getHooks(suite)[name].map(fn => fn(...(args as any))))
}

function updateTask(task: Task) {
  return rpc('onTaskUpdate', [task.id, task.result])
}

export async function runTest(test: Test) {
  if (test.mode !== 'run')
    return

  getSnapshotManager()?.setTest(test)

  test.result = {
    start: performance.now(),
    state: 'run',
  }
  updateTask(test)

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

  updateTask(test)
}

export async function runSuite(suite: Suite) {
  suite.result = {
    start: performance.now(),
    state: 'run',
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
      await callHook(suite, 'beforeAll', [suite])

      for (const tasksGroup of partitionSuiteChildren(suite)) {
        const computeMode = tasksGroup[0].computeMode
        if (computeMode === 'serial') {
          for (const c of tasksGroup)
            await runSuiteChild(c)
        }
        else if (computeMode === 'concurrent') {
          await Promise.all(tasksGroup.map(c => runSuiteChild(c)))
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
    else {
      suite.result.state = 'pass'
    }
  }

  updateTask(suite)
}

async function runSuiteChild(c: Task) {
  return c.type === 'test'
    ? runTest(c)
    : runSuite(c)
}

export async function runSuites(suites: Suite[]) {
  for (const suite of suites)
    await runSuite(suite)
}

export async function startTests(paths: string[]) {
  const files = await collectTests(paths)

  await rpc('onCollected', files)

  await runSuites(files)
}
