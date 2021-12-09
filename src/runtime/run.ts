import { HookListener, SuiteHooks } from 'vitest'
import { getSnapshotManager } from '../integrations/chai/snapshot'
import { File, Task, Suite } from '../types'
import { collectTests } from './collect'
import { getFn, getHooks } from './map'
import { rpc } from './rpc'

async function callHook<T extends keyof SuiteHooks>(suite: Suite, name: T, args: SuiteHooks[T][0] extends HookListener<infer A> ? A : never) {
  await Promise.all(getHooks(suite)[name].map(fn => fn(...(args as any))))
}

export async function runTask(task: Task) {
  if (task.mode !== 'run')
    return

  getSnapshotManager()?.setTask(task)

  rpc('onTaskBegin', task)

  task.result = {
    state: 'run',
    start: performance.now(),
  }

  if (task.mode === 'run') {
    try {
      await callHook(task.suite, 'beforeEach', [task, task.suite])
      await getFn(task)()
      task.result.state = 'pass'
    }
    catch (e) {
      task.result.state = 'fail'
      task.result.error = e
      process.exitCode = 1
    }
    try {
      await callHook(task.suite, 'afterEach', [task, task.suite])
    }
    catch (e) {
      task.result.state = 'fail'
      task.result.error = e
      process.exitCode = 1
    }
  }
  task.result.end = performance.now()

  rpc('onTaskEnd', task)
}

export async function runSuite(suite: Suite) {
  await rpc('onSuiteBegin', suite)

  if (suite.mode === 'skip') {
    suite.status = 'skip'
  }
  else if (suite.mode === 'todo') {
    suite.status = 'todo'
  }
  else {
    try {
      await callHook(suite, 'beforeAll', [suite])

      for (const childrenGroup of partitionSuiteChildren(suite)) {
        const computeMode = childrenGroup[0].computeMode
        if (computeMode === 'serial') {
          for (const c of childrenGroup)
            await runSuiteChild(c)
        }
        else if (computeMode === 'concurrent') {
          await Promise.all(childrenGroup.map(c => runSuiteChild(c)))
        }
      }

      await callHook(suite, 'afterAll', [suite])
    }
    catch (e) {
      suite.error = e
      suite.status = 'fail'
      process.exitCode = 1
    }
  }
  await rpc('onSuiteEnd', suite)
}

export async function runSuiteChild(c: (Task | Suite)) {
  return c.type === 'task'
    ? runTask(c)
    : runSuite(c)
}

export async function runFile(file: File) {
  const runnable = file.children.filter(i => i.mode === 'run')
  if (runnable.length === 0)
    return

  await rpc('onFileBegin', file)

  for (const suite of file.children)
    await runSuiteChild(suite)

  await rpc('onFileEnd', file)
}

export async function runFiles(filesMap: Record<string, File>) {
  await rpc('onCollected', Object.values(filesMap))

  for (const file of Object.values(filesMap))
    await runFile(file)
}

export async function startTests(paths: string[]) {
  const filesMap = await collectTests(paths)
  await runFiles(filesMap)
}

/**
 * Partition in tasks groups by consecutive computeMode ('serial', 'concurrent')
 */
function partitionSuiteChildren(suite: Suite) {
  let childrenGroup: (Task | Suite)[] = []
  const childrenGroups: (Task | Suite)[][] = []
  for (const c of suite.children) {
    if (childrenGroup.length === 0 || c.computeMode === childrenGroup[0].computeMode) {
      childrenGroup.push(c)
    }
    else {
      childrenGroups.push(childrenGroup)
      childrenGroup = [c]
    }
  }
  if (childrenGroup.length > 0)
    childrenGroups.push(childrenGroup)

  return childrenGroups
}
