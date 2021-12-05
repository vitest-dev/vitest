import fg from 'fast-glob'
import { HookListener } from 'vitest'
import { setupChai } from './integrations/chai/setup'
import { clearContext, defaultSuite } from './suite'
import { context } from './context'
import { File, Config, Task, Reporter, RunnerContext, Suite, RunMode } from './types'
import { DefaultReporter } from './reporters/default'
import { defaultIncludes, defaultExcludes } from './constants'
import { getSnapshotManager } from './integrations/chai/snapshot'

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

export async function runSite(suite: Suite, ctx: RunnerContext) {
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

      await Promise.all(suite.tasks.map(i => runTask(i, ctx)))
      // for (const t of suite.tasks)
      //   await runTask(t, ctx)

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

export async function runFile(file: File, ctx: RunnerContext) {
  const { reporter } = ctx

  const runableSuites = file.suites.filter(i => i.mode === 'run')
  if (runableSuites.length === 0)
    return

  await reporter.onFileBegin?.(file, ctx)

  if (ctx.config.parallel) {
    await Promise.all(file.suites.map(suite => runSite(suite, ctx)))
  }
  else {
    for (const suite of file.suites)
      await runSite(suite, ctx)
  }

  await reporter.onFileEnd?.(file, ctx)
}

export async function run(config: Config) {
  // setup chai
  await setupChai(config)

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

  if (config.jsdom)
    (await import('./integrations/jsdom')).setupJSDOM(globalThis)

  const files = await collectFiles(paths)

  const ctx: RunnerContext = {
    files,
    config,
    reporter,
  }

  await reporter.onCollected?.(ctx)

  for (const file of files)
    await runFile(file, ctx)

  const snapshot = getSnapshotManager()
  snapshot?.saveSnap()
  snapshot?.report()

  await reporter.onFinished?.(ctx)
}
