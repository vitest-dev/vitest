import { HookListener } from 'vitest'
import { File, ResolvedConfig, Task, RunnerContext, Suite } from '../types'
import { getSnapshotManager } from '../integrations/chai/snapshot'
import { DefaultReporter } from '../reporters/default'
// import { createWorker } from '../worker/manager'
// import { startWatcher } from './watcher'
// import { collectTests } from './collect'
// import { setupEnv } from './setup'
// import { globTestFiles } from './glob'

async function callHook<T extends keyof Suite['hooks']>(suite: Suite, name: T, args: Suite['hooks'][T][0] extends HookListener<infer A> ? A : never) {
  await Promise.all(suite.hooks[name].map(fn => fn(...(args as any))))
}

export async function runTask(task: Task, ctx: RunnerContext) {
  const { reporter } = ctx

  getSnapshotManager()?.setTask(task)

  await reporter.onTaskBegin?.(task, ctx)

  if (task.mode === 'run') {
    try {
      await callHook(task.suite, 'beforeEach', [task, task.suite])
      await task.fn()
      task.state = 'pass'
    }
    catch (e) {
      task.state = 'fail'
      task.error = e
      process.exitCode = 1
    }
    try {
      await callHook(task.suite, 'afterEach', [task, task.suite])
    }
    catch (e) {
      task.state = 'fail'
      task.error = e
      process.exitCode = 1
    }
  }

  await reporter.onTaskEnd?.(task, ctx)
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

      for (const taskGroup of partitionTasks(suite.tasks)) {
        const computeMode = taskGroup[0].computeMode
        if (computeMode === 'serial') {
          for (const t of taskGroup)
            await runTask(t, ctx)
        }
        else if (computeMode === 'concurrent') {
          await Promise.all(taskGroup.map(t => runTask(t, ctx)))
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

export async function runFile(file: File, ctx: RunnerContext) {
  const { reporter } = ctx

  const runnableSuites = file.suites.filter(i => i.mode === 'run')
  if (runnableSuites.length === 0)
    return

  await reporter.onFileBegin?.(file, ctx)

  if (ctx.config.parallel) {
    await Promise.all(file.suites.map(suite => runSuite(suite, ctx)))
  }
  else {
    for (const suite of file.suites)
      await runSuite(suite, ctx)
  }

  await reporter.onFileEnd?.(file, ctx)
}

export async function runFiles(filesMap: Record<string, File>, ctx: RunnerContext) {
  const { reporter } = ctx

  await reporter.onCollected?.(Object.values(filesMap), ctx)

  for (const file of Object.values(filesMap))
    await runFile(file, ctx)
}

/*
export async function run(config: ResolvedConfig) {
  await setupEnv(config)
  const ctx = await createRunnerContext(config)

  const { filesMap, snapshotManager, reporter } = ctx

  await reporter.onStart?.(config)

  const files: string[] = [] // await collectTests(testFilepaths)

  Object.assign(filesMap, files)

  await runFiles(filesMap, ctx)

  snapshotManager.saveSnap()

  await reporter.onFinished?.(ctx)

  if (config.watch)
    await startWatcher(ctx)
}
*/

export async function createRunnerContext(config: ResolvedConfig) {
  const ctx: RunnerContext = {
    filesMap: {},
    get files() {
      return Object.values(this.filesMap)
    },
    get suites() {
      return Object.values(this.filesMap)
        .reduce((suites, file) => suites.concat(file.suites), [] as Suite[])
    },
    get tasks() {
      return this.suites
        .reduce((tasks, suite) => tasks.concat(suite.tasks), [] as Task[])
    },
    config,
    reporter: config.reporter || new DefaultReporter(),
    snapshotManager: getSnapshotManager(),
  }

  return ctx
}
