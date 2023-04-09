import type { ModuleNode } from 'vite'
import type { ModuleGraphData, Vitest } from '../types'

export async function getModuleGraph(ctx: Vitest, id: string): Promise<ModuleGraphData> {
  const graph: Record<string, string[]> = {}
  const externalized = new Set<string>()
  const inlined = new Set<string>()

  function clearId(id?: string | null) {
    return id?.replace(/\?v=\w+$/, '') || ''
  }
  async function get(mod?: ModuleNode, seen = new Map<ModuleNode, string>()) {
    if (!mod || !mod.id)
      return
    if (seen.has(mod))
      return seen.get(mod)
    let id = clearId(mod.id)
    seen.set(mod, id)
    const rewrote = await ctx.vitenode.shouldExternalize(id)
    if (rewrote) {
      id = rewrote
      externalized.add(id)
      seen.set(mod, id)
    }
    else {
      inlined.add(id)
    }
    const mods = Array.from(mod.importedModules).filter(i => i.id && !i.id.includes('/vitest/dist/'))
    graph[id] = (await Promise.all(mods.map(m => get(m, seen)))).filter(Boolean) as string[]
    return id
  }
  await get(ctx.server.moduleGraph.getModuleById(id))
  return {
    graph,
    externalized: Array.from(externalized),
    inlined: Array.from(inlined),
  }
}
