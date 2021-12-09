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

      for (const taskGroup of partitionTasks(suite.tasks)) {
        const computeMode = taskGroup[0].computeMode
        if (computeMode === 'serial') {
          for (const t of taskGroup)
            await runTask(t)
        }
        else if (computeMode === 'concurrent') {
          await Promise.all(taskGroup.map(t => runTask(t)))
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

/**
 * Partition in tasks groups by consecutive computeMode ('serial', 'concurrent')
 */
function partitionTasks(tasks: Task[]) {
  let taskGroup: Task[] = []
  const groupedTasks: Task[][] = []
  for (const task of tasks) {
    if (taskGroup.length === 0 || task.computeMode === taskGroup[0].computeMode) {
      taskGroup.push(task)
    }
    else {
      groupedTasks.push(taskGroup)
      taskGroup = [task]
    }
  }
  if (taskGroup.length > 0)
    groupedTasks.push(taskGroup)

  return groupedTasks
}

export async function runFile(file: File) {
  const runnableSuites = file.suites.filter(i => i.mode === 'run')
  if (runnableSuites.length === 0)
    return

  await rpc('onFileBegin', file)

  for (const suite of file.suites)
    await runSuite(suite)

  await rpc('onFileEnd', file)
}

export async function runFiles(filesMap: Record<string, File>) {
  await rpc('onCollected', Object.values(filesMap))

  for (const file of Object.values(filesMap))
    await runFile(file)
}

export async function startTests(paths: string[]) {
  await rpc('onStart')

  const filesMap = await collectTests(paths)

  await runFiles(filesMap)

  await rpc('onFinished', Object.values(filesMap))
}
