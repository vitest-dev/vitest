import chai from 'chai'
import fg from 'fast-glob'
import SinonChai from 'sinon-chai'
import { clearContext, defaultSuite } from './suite'
import { context } from './context'
import { File, Config, Task, Reporter, RunnerContext, Suite, RunMode } from './types'
import { afterEachHook, afterFileHook, afterAllHook, afterSuiteHook, beforeEachHook, beforeFileHook, beforeAllHook, beforeSuiteHook } from './hooks'
import { SnapshotPlugin } from './snapshot'
import { DefaultReporter } from './reporters/default'
import { defaultIncludes, defaultExcludes } from './constants'

export async function runTask(task: Task, ctx: RunnerContext) {
  const { reporter } = ctx

  await reporter.onTaskBegin?.(task, ctx)

  if (task.mode === 'run') {
    await beforeEachHook.fire(task)
    try {
      await task.fn()
      task.state = 'pass'
    }
    catch (e) {
      task.state = 'fail'
      task.error = e
    }
    await afterEachHook.fire(task)
  }

  await reporter.onTaskEnd?.(task, ctx)
}

export async function collectFiles(paths: string[]) {
  const files: File[] = []

  for (const filepath of paths) {
    const file: File = {
      filepath,
      suites: [],
      collected: false,
    }

    clearContext()
    try {
      await import(filepath)

      const collectors = [defaultSuite, ...context.suites]
      for (const c of collectors) {
        context.currentSuite = c
        file.suites.push(await c.collect(file))
      }

      file.collected = true
    }
    catch (e) {
      file.error = e
      file.collected = false
      process.exitCode = 1
    }

    files.push(file)
  }

  const allSuites = files.reduce((suites, file) => suites.concat(file.suites), [] as Suite[])

  interpretOnlyMode(allSuites)
  allSuites.forEach((i) => {
    if (i.mode === 'skip')
      i.tasks.forEach(t => t.mode === 'run' && (t.state = 'skip'))
    else
      interpretOnlyMode(i.tasks)
  })

  return files
}

/**
 * If any items been marked as `only`, mark all other items as `skip`.
 */
function interpretOnlyMode(items: {mode: RunMode}[]) {
  if (items.some(i => i.mode === 'only')) {
    items.forEach((i) => {
      if (i.mode === 'run')
        i.mode = 'skip'
      else if (i.mode === 'only')
        i.mode = 'run'
    })
  }
}

export async function runFile(file: File, ctx: RunnerContext) {
  const { reporter } = ctx

  const runableSuites = file.suites.filter(i => i.mode === 'run')
  if (runableSuites.length === 0)
    return

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

export async function run(config: Config) {
  const { rootDir = process.cwd() } = config

  // setup chai
  chai.use(await SnapshotPlugin({
    rootDir,
    update: config.updateSnapshot,
  }))
  chai.use(SinonChai)

  // collect files
  let paths = await fg(
    config.includes || defaultIncludes,
    {
      absolute: true,
      cwd: config.rootDir,
      ignore: config.excludes || defaultExcludes,
    },
  )

  if (config.nameFilters?.length)
    paths = paths.filter(i => config.nameFilters!.some(f => i.includes(f)))

  if (!paths.length) {
    console.error('No test files found')
    process.exitCode = 1
    return
  }

  const reporter: Reporter = new DefaultReporter()

  await reporter.onStart?.(config)

  if (config.global)
    (await import('./global')).registerApiGlobally()

  const files = await collectFiles(paths)

  const ctx: RunnerContext = {
    files,
    config,
    reporter,
  }

  await reporter.onCollected?.(ctx)
  await beforeAllHook.fire()

  for (const file of files)
    await runFile(file, ctx)

  await afterAllHook.fire()
  await reporter.onFinished?.(ctx)
}
