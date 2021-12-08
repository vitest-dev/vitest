import { slash } from '@antfu/utils'
import { collectTests } from '../runtime/collect'
import { RunnerContext } from '../types'
import { runFiles } from '../runtime/run'

export async function startWatcher(ctx: RunnerContext) {
  const { reporter, snapshotManager, filesMap } = ctx
  await reporter.onWatcherStart?.(ctx)

  let timer: any

  const changedTests = new Set<string>()
  const seen = new Set<string>()
  const { server, moduleCache } = process.__vitest__

  server.watcher.on('change', async(id) => {
    id = slash(id)
    getDependencyTests(id, ctx, changedTests, seen)
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
      await runFiles(newFilesMap)

      snapshotManager.saveSnap()

      await reporter.onFinished?.(ctx, Object.values(newFilesMap))
      await reporter.onWatcherStart?.(ctx)
    }, 100)
  })

  // add an empty promise so it never resolves
  await new Promise(() => { })
}

export function getDependencyTests(id: string, ctx: RunnerContext, set = new Set<string>(), seen = new Set<string>()): Set<string> {
  if (seen.has(id) || set.has(id))
    return set

  seen.add(id)
  if (id in ctx.filesMap) {
    set.add(id)
    return set
  }

  const mod = process.__vitest__.server.moduleGraph.getModuleById(id)

  if (mod) {
    mod.importers.forEach((i) => {
      if (i.id)
        getDependencyTests(i.id, ctx, set, seen)
    })
  }

  return set
}
