import readline from 'readline'
import { slash } from '../utils'
import { isTargetFile } from './glob'
import type { Vitest } from './index'

const WATCHER_DEBOUNCE = 50
const RERUN_FAILED = false

export async function startWatcher(ctx: Vitest) {
  const { server } = ctx
  ctx.reporters.forEach(r => r.onWatcherStart?.())

  let timer: any

  const changedTests = new Set<string>()
  const seen = new Set<string>()
  let isFirstRun = true
  let promise: Promise<void> | undefined

  server.watcher.on('change', (id) => {
    id = slash(id)
    getAffectedTests(ctx, id, changedTests, seen)
    if (changedTests.size === 0)
      return
    rerunFile(id)
  })
  server.watcher.on('unlink', (id) => {
    id = slash(id)
    seen.add(id)

    if (id in ctx.state.filesMap) {
      delete ctx.state.filesMap[id]
      changedTests.delete(id)
    }
  })
  server.watcher.on('add', async(id) => {
    id = slash(id)
    if (isTargetFile(id, ctx.config)) {
      changedTests.add(id)
      rerunFile(id)
    }
  })

  async function rerunFile(id: string) {
    await promise
    clearTimeout(timer)
    timer = setTimeout(async() => {
      if (changedTests.size === 0) {
        seen.clear()
        return
      }

      isFirstRun = false

      // add previously failed files
      if (RERUN_FAILED) {
        ctx.state.getFiles().forEach((file) => {
          if (file.result?.state === 'fail')
            changedTests.add(file.filepath)
        })
      }

      const invalidates = Array.from(seen)
      const tests = Array.from(changedTests)
      changedTests.clear()
      seen.clear()

      promise = start(tests, id, invalidates)
        .then(() => { promise = undefined })
      await promise
    }, WATCHER_DEBOUNCE)
  }

  async function start(tests: string[], id: string, invalidates: string[]) {
    await ctx.report('onWatcherRerun', tests, id)

    await ctx.pool?.runTests(tests, invalidates)

    await ctx.report('onFinished', ctx.state.getFiles(tests))
    await ctx.report('onWatcherStart')
  }

  // listen to keyboard input
  if (process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin)
    process.stdin.setRawMode(true)
    process.stdin.on('keypress', (str: string) => {
      if (str === '\x03' || str === '\x1B') // ctrl-c or esc
        process.exit()

      // is running, ignore keypress
      if (promise)
        return

      // press any key to exit on first run
      if (isFirstRun)
        process.exit()

      // TODO: add more commands
      // console.log(str, key)
    })
  }

  // add an empty promise so it never resolves
  await new Promise(() => { })
}

export function getAffectedTests(ctx: Vitest, id: string, set = new Set<string>(), seen = new Set<string>()): Set<string> {
  if (seen.has(id) || set.has(id) || id.includes('/node_modules/') || id.includes('/vitest/dist/'))
    return set

  seen.add(id)

  if (id in ctx.state.filesMap) {
    set.add(id)
    return set
  }

  const mod = ctx.server.moduleGraph.getModuleById(id)

  if (mod) {
    mod.importers.forEach((i) => {
      if (i.id)
        getAffectedTests(ctx, i.id, set, seen)
    })
  }

  return set
}
