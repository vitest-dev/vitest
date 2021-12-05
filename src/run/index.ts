import fg from 'fast-glob'
import { HookListener } from 'vitest'
import { setupChai } from '../integrations/chai/setup'
import { clearContext, defaultSuite } from '../suite'
import { context } from '../context'
import { File, ResolvedConfig, Task, Reporter, RunnerContext, Suite, RunMode } from '../types'
import { DefaultReporter } from '../reporters/default'
import { defaultIncludes, defaultExcludes } from '../constants'
import { getSnapshotManager } from '../integrations/chai/snapshot'

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
  const files: Record<string, File> = {}

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

    files[filepath] = file
  }

  const allFiles = Object.values(files)
  const allSuites = allFiles.reduce((suites, file) => suites.concat(file.suites), [] as Suite[])

  interpretOnlyMode(allSuites)
  allSuites.forEach((i) => {
    if (i.mode === 'skip')
      i.tasks.forEach(t => t.mode === 'run' && (t.mode = 'skip'))
    else
      interpretOnlyMode(i.tasks)

    i.tasks.forEach(t => t.mode === 'skip' && (t.state = 'skip'))
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

export async function run(config: ResolvedConfig) {
  // if watch, tell `vite-node` not to end the process
  if (config.watch)
    process.__vite_node__.watch = true

  // setup chai
  await setupChai(config)

  // collect files
  let testFilepaths = await fg(
    config.includes || defaultIncludes,
    {
      absolute: true,
      cwd: config.root,
      ignore: config.excludes || defaultExcludes,
    },
  )

  // if name filters are provided by the CLI
  if (config.filters?.length)
    testFilepaths = testFilepaths.filter(i => config.filters!.some(f => i.includes(f)))

  if (!testFilepaths.length) {
    console.error('No test files found')
    process.exitCode = 1
    return
  }

  // setup envs
  if (config.global)
    (await import('../integrations/global')).registerApiGlobally()
  if (config.jsdom)
    (await import('../integrations/jsdom')).setupJSDOM(globalThis)

  const reporter: Reporter = new DefaultReporter()
  await reporter.onStart?.(config)

  const filesMap = await collectFiles(testFilepaths)
  const ctx: RunnerContext = {
    filesMap,
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
    reporter,
  }

  await runFiles(filesMap, ctx)

  const snapshot = getSnapshotManager()
  snapshot?.saveSnap()
  snapshot?.report()

  await reporter.onFinished?.(ctx)

  if (config.watch)
    startWatcher(ctx)
}

export async function startWatcher(ctx: RunnerContext) {
  await ctx.reporter.onWatcherStart?.(ctx)

  let timer: any

  const changedTests = new Set<string>()
  const seen = new Set<string>()
  const { server, moduleCache } = process.__vite_node__
  server.watcher.on('change', async(id) => {
    getDependencyTests(id, ctx, changedTests, seen)
    seen.forEach(i => moduleCache.delete(i))
    seen.clear()

    if (changedTests.size === 0)
      return

    clearTimeout(timer)
    timer = setTimeout(async() => {
      const snapshot = getSnapshotManager()
      const paths = Array.from(changedTests)
      changedTests.clear()

      await ctx.reporter.onWatcherRerun?.(paths, id, ctx)
      paths.forEach(i => moduleCache.delete(i))

      const files = await collectFiles(paths)
      Object.assign(ctx.filesMap, files)
      await runFiles(files, ctx)

      // TODO: clear snapshot state
      snapshot?.saveSnap()
      snapshot?.report()

      await ctx.reporter.onWatcherStart?.(ctx)
    }, 100)
  })
}

function getDependencyTests(id: string, ctx: RunnerContext, set = new Set<string>(), seen = new Set<string>()): Set<string> {
  if (seen.has(id) || set.has(id))
    return set

  seen.add(id)
  if (id in ctx.filesMap) {
    set.add(id)
    return set
  }

  const mod = process.__vite_node__.server.moduleGraph.getModuleById(id)

  if (mod) {
    mod.importers.forEach((i) => {
      if (i.id)
        getDependencyTests(i.id, ctx, set, seen)
    })
  }

  return set
}
