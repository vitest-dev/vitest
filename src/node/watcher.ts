import { slash } from '@antfu/utils'
import { VitestContext } from '../types'
import { WorkerPool } from './pool'

export async function startWatcher(ctx: VitestContext, pool: WorkerPool) {
  const { reporter, server, moduleCache } = ctx
  reporter.onWatcherStart?.()

  let timer: any

  const changedTests = new Set<string>()
  const seen = new Set<string>()

  // TODO: on('add') hook and glob to detect newly added files
  server.watcher.on('change', async(id) => {
    id = slash(id)

    // TODO: send this dependency tree to worker
    getAffectedTests(id, changedTests, seen)
    seen.forEach(i => moduleCache.delete(i))
    seen.clear()

    if (changedTests.size === 0)
      return

    clearTimeout(timer)
    timer = setTimeout(async() => {
      if (changedTests.size === 0)
        return

      // add previously failed files
      ctx.state.getFiles().forEach((file) => {
        if (file.result?.state === 'fail')
          changedTests.add(file.filepath)
      })
      const paths = Array.from(changedTests)
      changedTests.clear()
      // TODO: snapshotManager.clear()

      await pool.runTestFiles(paths)

      await reporter.onFinished?.(ctx.state.getFiles(paths))
      await reporter.onWatcherStart?.()
    }, 100)
  })

  // add an empty promise so it never resolves
  await new Promise(() => { })
}

export function getAffectedTests(id: string, set = new Set<string>(), seen = new Set<string>()): Set<string> {
  if (seen.has(id) || set.has(id))
    return set

  const { server, state } = process.__vitest__

  seen.add(id)
  if (id in state.filesMap) {
    set.add(id)
    return set
  }

  const mod = server.moduleGraph.getModuleById(id)

  if (mod) {
    mod.importers.forEach((i) => {
      if (i.id)
        getAffectedTests(i.id, set, seen)
    })
  }

  return set
}
