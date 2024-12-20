import type { ModuleNode } from 'vite'
import type { Vitest } from '../node/core'
import type { ModuleGraphData } from '../types/general'

export async function getModuleGraph(
  ctx: Vitest,
  projectName: string,
  id: string,
  browser = false,
): Promise<ModuleGraphData> {
  const graph: Record<string, string[]> = {}
  const externalized = new Set<string>()
  const inlined = new Set<string>()

  const project = ctx.getProjectByName(projectName)

  async function get(mod?: ModuleNode, seen = new Map<ModuleNode, string>()) {
    if (!mod || !mod.id) {
      return
    }
    if (mod.id === '\0@vitest/browser/context') {
      return
    }
    if (seen.has(mod)) {
      return seen.get(mod)
    }
    let id = clearId(mod.id)
    seen.set(mod, id)
    const rewrote = browser
      ? mod.file?.includes(project.browser!.vite.config.cacheDir)
        ? mod.id
        : false
      : await project.vitenode.shouldExternalize(id)
    if (rewrote) {
      id = rewrote
      externalized.add(id)
      seen.set(mod, id)
    }
    else {
      inlined.add(id)
    }
    const mods = Array.from(mod.importedModules).filter(
      i => i.id && !i.id.includes('/vitest/dist/'),
    )
    graph[id] = (await Promise.all(mods.map(m => get(m, seen)))).filter(
      Boolean,
    ) as string[]
    return id
  }
  if (browser && project.browser) {
    await get(project.browser.vite.moduleGraph.getModuleById(id))
  }
  else {
    await get(project.vite.moduleGraph.getModuleById(id))
  }

  return {
    graph,
    externalized: Array.from(externalized),
    inlined: Array.from(inlined),
  }
}

function clearId(id?: string | null) {
  return id?.replace(/\?v=\w+$/, '') || ''
}
