import chai from 'chai'
import fg from 'fast-glob'
import SinonChai from 'sinon-chai'
import { clearContext, defaultSuite } from './suite'
import { context } from './context'
import { File, Config, Task, Reporter, RunnerContext, Suite } from './types'
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

  return files
}

/**
 * If any items been marked as `only`, mark all other items as `skip`.
 */
function interpretOnlyMode(suites: Suite[]) {
  if (suites.some(i => i.mode === 'only' || i.tasks.find(t => t.mode === 'only'))) {
    // Only mode, some suites or tasks are marked as 'only'
    suites.forEach((suite) => {
      if (suite.mode === 'run') {
        // Convert t.mode === 'only' to t.mode === 'run', skip the rest
        suite.tasks.forEach((t) => {
          if (t.mode === 'run')
            t.mode = t.state = 'skip'
          else if (t.mode === 'only')
            t.mode = 'run'
        })
      }
      else if (suite.mode === 'only') {
        // Mark this suite as runnable, run every task in it
        suite.mode = 'run'
        suite.tasks.forEach(t => t.mode === 'only' && (t.mode = 'run'))
      }
    })
  }
}

export async function runFile(file: File, ctx: RunnerContext) {
  const { reporter } = ctx

  const runnableSuites = file.suites.filter(i => i.mode === 'run')
  if (runnableSuites.length === 0)
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
