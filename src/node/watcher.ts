import { slash } from '@antfu/utils'
import { runSuites } from '../runtime/run'
import { collectTests } from '../runtime/collect'
import { rpc } from '../runtime/rpc'

export async function startWatcher(ctx: any) {
  const { reporter, snapshotManager, filesMap } = ctx
  await rpc('onWatcherStart')

  let timer: any

  const changedTests = new Set<string>()
  const seen = new Set<string>()
  const { server, moduleCache } = process.__vitest__

  server.watcher.on('change', async(id) => {
    id = slash(id)
    getAffectedTests(id, changedTests, seen)
    seen.forEach(i => moduleCache.delete(i))
    seen.clear()

    if (changedTests.size === 0)
      return

    clearTimeout(timer)
    timer = setTimeout(async() => {
      if (changedTests.size === 0)
        return

      snapshotManager.clear()
      const paths = Array.from(changedTests)
      changedTests.clear()

      await reporter.onWatcherRerun?.(paths, id, ctx)
      paths.forEach(i => moduleCache.delete(i))

      const newFilesMap = await collectTests(paths)
      Object.assign(filesMap, newFilesMap)
      const files = Object.values(filesMap)
      await rpc('onCollected', files)
      await runSuites(files)

      snapshotManager.saveSnap()

      await reporter.onFinished?.(ctx, Object.values(newFilesMap))
      await reporter.onWatcherStart?.(ctx)
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
