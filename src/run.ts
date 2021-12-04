import chai from 'chai'
import fg from 'fast-glob'
import { clearContext, defaultSuite } from './suite'
import { context } from './context'
import { File, Options, Suite, Task, Reporter, RunnerContext } from './types'
import { afterEachHook, afterFileHook, afterAllHook, afterSuiteHook, beforeEachHook, beforeFileHook, beforeAllHook, beforeSuiteHook } from './hooks'
import { SnapshotPlugin } from './snapshot'
import { DefaultReporter } from './reporters/default'

export async function runTask(task: Task, ctx: RunnerContext) {
  const { reporter } = ctx
  await reporter.onTaskBegin?.(task, ctx)
  await beforeEachHook.fire(task)

  if (task.suite.mode === 'skip' || task.mode === 'skip') {
    task.status = 'skip'
  }
  else if (task.suite.mode === 'todo' || task.mode === 'todo') {
    task.status = 'todo'
  }
  else {
    try {
      await task.fn()
      task.status = 'pass'
    }
    catch (e) {
      task.status = 'fail'
      task.error = e
    }
  }

  await afterEachHook.fire(task)
  await reporter.onTaskEnd?.(task, ctx)
}

export async function collectFiles(files: string[]) {
  const result: File[] = []

  for (const filepath of files) {
    clearContext()
    await import(filepath)
    const collectors = [defaultSuite, ...context.suites]
    const suites: Suite[] = []

    const file: File = {
      filepath,
      suites: [],
    }

    for (const c of collectors) {
      context.currentSuite = c
      suites.push(await c.collect(file))
    }

    file.suites = suites

    result.push(file)
  }

  return result
}

export async function runFile(file: File, ctx: RunnerContext) {
  const { reporter } = ctx

  await reporter.onFileBegin?.(file, ctx)
  await beforeFileHook.fire(file)
  for (const suite of file.suites) {
    await reporter.onSuiteBegin?.(suite, ctx)
    await beforeSuiteHook.fire(suite)

    for (const t of suite.tasks)
      await runTask(t, ctx)

    await afterSuiteHook.fire(suite)
    await reporter.onSuiteEnd?.(suite, ctx)
  }
  await afterFileHook.fire(file)
  await reporter.onFileEnd?.(file, ctx)
}

export async function run(options: Options = {}) {
  const { rootDir = process.cwd() } = options

  chai.use(await SnapshotPlugin({
    rootDir,
    update: options.updateSnapshot,
  }))

  const paths = await fg(
    options.includes || ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    {
      absolute: true,
      cwd: options.rootDir,
      ignore: options.excludes || ['**/node_modules/**', '**/dist/**'],
    },
  )

  if (!paths.length) {
    console.error('No test files found')
    process.exitCode = 1
    return
  }

  const reporter: Reporter = new DefaultReporter()

  await reporter.onStart?.(options)

  const files = await collectFiles(paths)

  const ctx: RunnerContext = {
    files,
    mode: isOnlyMode(files) ? 'only' : 'all',
    userOptions: options,
    reporter,
  }

  await reporter.onCollected?.(ctx)
  await beforeAllHook.fire()

  for (const file of files)
    await runFile(file, ctx)

  await afterAllHook.fire()
  await reporter.onFinished?.(ctx)
}

function isOnlyMode(files: File[]) {
  return !!files.find(
    file => file.suites.find(
      suite => suite.mode === 'only' || suite.tasks.find(t => t.mode === 'only'),
    ),
  )
}
