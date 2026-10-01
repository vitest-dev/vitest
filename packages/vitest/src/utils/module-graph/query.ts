import type { ModuleGraphData } from '../../types/general'
import type { ModuleGraphEnvironment, ModuleGraphNode, ModuleGraphProject } from './types'

export function getTestFileModuleGraph(
  project: ModuleGraphProject,
  environment: ModuleGraphEnvironment,
  testFilePath: string,
): ModuleGraphData {
  const graph: Record<string, string[]> = {}
  const externalized = new Set<string>()
  const inlined = new Set<string>()
  const browser = project.config.browser.enabled
  const seen = new Map<ModuleGraphNode, string>()

  function get(mod?: ModuleGraphNode) {
    if (!mod || !mod.id) {
      return
    }
    if (
      mod.id === '\0vitest/browser' ||
      // the export helper is injected in all vue files
      // so the module graph becomes too bouncy
      mod.id.includes('plugin-vue:export-helper')
    ) {
      return
    }
    if (seen.has(mod)) {
      return seen.get(mod)
    }
    const id = clearId(mod.id)
    seen.set(mod, id)
    if (id.startsWith('__vite-browser-external:')) {
      const external = id.slice('__vite-browser-external:'.length)
      externalized.add(external)
      return external
    }
    const external = project._resolver.wasExternalized(id)
    if (typeof external === 'string') {
      externalized.add(external)
      return external
    }
    if (browser && mod.file?.includes(project.browser!.vite.config.cacheDir)) {
      externalized.add(mod.id)
      return id
    }
    inlined.add(id)
    const mods = Array.from(mod.importedModules).filter(
      (i) => i.id && !i.id.includes('/vitest/dist/'),
    )
    graph[id] = mods.map((m) => get(m)).filter(Boolean) as string[]
    return id
  }

  get(environment.moduleGraph.getModuleById(testFilePath))
  project.config.setupFiles.forEach((setupFile) => {
    get(environment.moduleGraph.getModuleById(setupFile))
  })

  return {
    graph,
    externalized: Array.from(externalized),
    inlined: Array.from(inlined),
  }
}

function clearId(id?: string | null) {
  return id?.replace(/\?v=\w+$/, '') || ''
}
