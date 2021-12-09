import { HookListener } from 'vitest'
import { File, ResolvedConfig, Task, RunnerContext, Suite, RunMode, SuiteHooks } from '../types'
import { getSnapshotManager } from '../integrations/chai/snapshot'
import { startWatcher } from '../node/watcher'
import { globTestFiles } from '../node/glob'
import { getFn, getHooks } from './map'
import { collectTests } from './collect'
import { setupRunner } from './setup'

async function callHook<T extends keyof SuiteHooks>(suite: Suite, name: T, args: SuiteHooks[T][0] extends HookListener<infer A> ? A : never) {
  await Promise.all(getHooks(suite)[name].map(fn => fn(...(args as any))))
}

export async function runTask(task: Task, ctx: RunnerContext) {
  if (task.mode !== 'run')
    return

  const { reporter } = ctx

  getSnapshotManager()?.setTask(task)

  await reporter.onTaskBegin?.(task, ctx)
  task.result = {
    start: performance.now(),
    state: 'run',
  }

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

  task.result.end = performance.now()

  await reporter.onTaskEnd?.(task, ctx)
}

/**
 * If any items been marked as `only`, mark all other items as `skip`.
 */
export function interpretOnlyMode(items: { mode: RunMode }[]) {
  if (items.some(i => i.mode === 'only')) {
    items.forEach((i) => {
      if (i.mode === 'run')
        i.mode = 'skip'
      else if (i.mode === 'only')
        i.mode = 'run'
    })
  }
}

export async function runSuite(suite: Suite, ctx: RunnerContext) {
  const { reporter } = ctx

  await reporter.onSuiteBegin?.(suite, ctx)

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
            await runSuiteChild(c, ctx)
        }
        else if (computeMode === 'concurrent') {
          await Promise.all(childrenGroup.map(c => runSuiteChild(c, ctx)))
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
  await reporter.onSuiteEnd?.(suite, ctx)
}

async function runSuiteChild(c: (Task | Suite), ctx: RunnerContext) {
  return c.type === 'task' ? runTask(c, ctx) : runSuite(c, ctx)
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

export async function runFile(file: File, ctx: RunnerContext) {
  const { reporter } = ctx

  const runnable = file.children.filter(i => i.mode === 'run')
  if (runnable.length === 0)
    return

  await reporter.onFileBegin?.(file, ctx)

  if (ctx.config.parallel) {
    await Promise.all(file.children.map(c => runSuiteChild(c, ctx)))
  }
  else {
    for (const c of file.children)
      await runSuiteChild(c, ctx)
  }

  await reporter.onFileEnd?.(file, ctx)
}

export async function runFiles(filesMap: Record<string, File>, ctx: RunnerContext) {
  const { reporter } = ctx

  await reporter.onCollected?.(Object.values(filesMap), ctx)

  for (const file of Object.values(filesMap))
    await runFile(file, ctx)
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

  const files = await collectTests(testFilepaths)

  Object.assign(filesMap, files)

  await runFiles(filesMap, ctx)

  snapshotManager.saveSnap()

  await reporter.onFinished?.(ctx)

  if (config.watch)
    await startWatcher(ctx)
}
