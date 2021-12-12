import type { VitestContext } from '../types'
import { slash } from '../utils'
import { isTargetFile } from './glob'
import type { WorkerPool } from './pool'

const WATCHER_DEBOUNCE = 50

export async function startWatcher(ctx: VitestContext, pool: WorkerPool) {
  const { reporter, server } = ctx
  reporter.onWatcherStart?.()

  let timer: any

  const changedTests = new Set<string>()
  const seen = new Set<string>()
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

      // add previously failed files
      ctx.state.getFiles().forEach((file) => {
        if (file.result?.state === 'fail')
          changedTests.add(file.filepath)
      })

      const invalidates = Array.from(seen)
      const tests = Array.from(changedTests)
      changedTests.clear()
      seen.clear()

      promise = start(tests, id, invalidates)
      await promise
    }, WATCHER_DEBOUNCE)
  }

  async function start(tests: string[], id: string, invalidates: string[]) {
    await reporter.onWatcherRerun?.(tests, id)

    await pool.runTestFiles(tests, invalidates)

    await reporter.onFinished?.(ctx.state.getFiles(tests))
    await reporter.onWatcherStart?.()
  }

  // add an empty promise so it never resolves
  await new Promise(() => { })
}

export function getAffectedTests(ctx: VitestContext, id: string, set = new Set<string>(), seen = new Set<string>()): Set<string> {
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
