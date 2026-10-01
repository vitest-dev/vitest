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
  const roots = collector.add(testFilePath)
  return { modules: collector.modules, roots }
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
  modules: ModuleGraphData['modules']
  add: (testFilePath: string) => string[]
} {
  const modules: ModuleGraphData['modules'] = {}
  const browser = project.config.browser.enabled
  const seen = new Map<EnvironmentModuleNode, string>()

  function addExternal(id: string) {
    modules[id] ??= { external: true, imports: [] }
    return id
  }

  function get(mod?: EnvironmentModuleNode): string | undefined {
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
      return addExternal(id.slice('__vite-browser-external:'.length))
    }
    const external = project._resolver.wasExternalized(id)
    if (typeof external === 'string') {
      return addExternal(external)
    }
    if (browser && mod.file?.includes(project.browser!.vite.config.cacheDir)) {
      return addExternal(id)
    }
    const module: ModuleGraphData['modules'][string] = { external: false, imports: [] }
    modules[id] = module
    module.imports = Array.from(mod.importedModules)
      .filter((i) => i.id && !i.id.includes('/vitest/dist/'))
      .map((m) => get(m))
      .filter((id) => id != null)
    return id
  }

  // returns graph roots of the test file including setup files
  function add(testFilePath: string): string[] {
    return [testFilePath, ...project.config.setupFiles]
      .map((file) => get(environment.moduleGraph.getModuleById(file)))
      .filter((id) => id != null)
  }

  return { modules, add }
}

function clearId(id?: string | null) {
  return id?.replace(/\?v=\w+$/, '') || ''
}
