import type { DevEnvironment, EnvironmentModuleNode } from 'vite'
import type { Vitest } from '../node/core'
import type { TestProject } from '../node/project'
import type { ModuleGraphData } from '../types/general'
import { getTestFileEnvironment } from './environments'

export async function getModuleGraph(
  ctx: Vitest,
  projectName: string,
  testFilePath: string,
  viteEnvironment?: string,
): Promise<ModuleGraphData> {
  const project = ctx.getProjectByName(projectName)
  const environment = getModuleGraphEnvironment(project, testFilePath, viteEnvironment)
  const collector = createModuleGraphCollector(project, environment)
  collector.add(testFilePath)
  return collector.getData()
}

export function getModuleGraphEnvironment(
  project: TestProject,
  testFilePath: string,
  viteEnvironment?: string,
): DevEnvironment {
  let environment: DevEnvironment | undefined

  if (viteEnvironment) {
    environment = project.vite.environments[viteEnvironment]
  } else {
    environment =
      project.config.experimental.viteModuleRunner === false
        ? project.vite.environments.__vitest__
        : getTestFileEnvironment(project, testFilePath, project.config.browser.enabled)
  }

  if (!environment) {
    throw new Error(`Cannot find environment for ${testFilePath}`)
  }
  return environment
}

export function createModuleGraphCollector(
  project: TestProject,
  environment: DevEnvironment,
): {
  add: (testFilePath: string) => string[]
  getData: () => ModuleGraphData
} {
  const graph: Record<string, string[]> = {}
  const externalized = new Set<string>()
  const inlined = new Set<string>()
  const browser = project.config.browser.enabled
  const seen = new Map<EnvironmentModuleNode, string>()

  function get(mod?: EnvironmentModuleNode) {
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

  // returns graph roots of the test file including setup files
  function add(testFilePath: string): string[] {
    return [testFilePath, ...project.config.setupFiles]
      .map((file) => get(environment.moduleGraph.getModuleById(file)))
      .filter((id) => id != null)
  }

  return {
    add,
    getData: () => ({
      graph,
      externalized: Array.from(externalized),
      inlined: Array.from(inlined),
    }),
  }
}

function clearId(id?: string | null) {
  return id?.replace(/\?v=\w+$/, '') || ''
}
