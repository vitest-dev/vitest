import type { EnvironmentModuleNode } from 'vite'
import type { Vitest } from '../node/core'
import type { ModuleGraphData } from '../types/general'
import { getTestFileEnvironment } from './environments'

export async function getModuleGraph(
  ctx: Vitest,
  projectName: string,
  testFilePath: string,
  browser = false,
): Promise<ModuleGraphData> {
  const graph: Record<string, string[]> = {}
  const externalized = new Set<string>()
  const inlined = new Set<string>()

  const project = ctx.getProjectByName(projectName)

  const environment = project.config.experimental.viteModuleRunner === false
    ? project.vite.environments.__vitest__
    : getTestFileEnvironment(project, testFilePath, browser)

  if (!environment) {
    throw new Error(`Cannot find environment for ${testFilePath}`)
  }
  const seen = new Map<EnvironmentModuleNode, string>()

  function get(mod?: EnvironmentModuleNode) {
    if (!mod || !mod.id) {
      return
    }
    if (
      mod.id === '\0vitest/browser'
      // the export helper is injected in all vue files
      // so the module graph becomes too bouncy
      || mod.id.includes('plugin-vue:export-helper')
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
      i => i.id && !i.id.includes('/vitest/dist/'),
    )
    graph[id] = mods.map(m => get(m)).filter(
      Boolean,
    ) as string[]
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
