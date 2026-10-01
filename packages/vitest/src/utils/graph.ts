import type { DevEnvironment, EnvironmentModuleNode } from 'vite'
import type { Vitest } from '../node/core'
import type { TestProject } from '../node/project'
import type { TestModule } from '../node/reporters/reported-tasks'
import type {
  ModuleGraphData,
  SharedModuleGraphByEnvironment,
  SharedModuleGraphByProject,
  SharedModuleGraphData,
} from '../types/general'
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
  return { modules: collector.data.modules, roots }
}

export function getSharedModuleGraphByProject(
  testModules: ReadonlyArray<TestModule>,
): SharedModuleGraphByProject {
  const testModulesByProject = new Map<TestProject, TestModule[]>()
  for (const testModule of testModules) {
    const projectTestModules = testModulesByProject.get(testModule.project) ?? []
    projectTestModules.push(testModule)
    testModulesByProject.set(testModule.project, projectTestModules)
  }

  const result: SharedModuleGraphByProject = {}
  for (const [project, projectTestModules] of testModulesByProject) {
    result[project.name] = getSharedModuleGraphByEnvironment(project, projectTestModules)
  }
  return result
}

function getSharedModuleGraphByEnvironment(
  project: TestProject,
  testModules: TestModule[],
): SharedModuleGraphByEnvironment {
  const collectors: { [environmentName: string]: ModuleGraphCollector } = {}
  for (const testModule of testModules) {
    const environment = getModuleGraphEnvironment(
      project,
      testModule.moduleId,
      testModule.viteEnvironment?.name,
    )
    collectors[environment.name] ??= createModuleGraphCollector(project, environment)
    collectors[environment.name].add(testModule.moduleId)
  }
  return Object.fromEntries(
    Object.entries(collectors).map(([name, collector]) => [name, collector.data]),
  )
}

function getModuleGraphEnvironment(
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

interface ModuleGraphCollector {
  data: SharedModuleGraphData
  add: (testFilePath: string) => string[]
}

function createModuleGraphCollector(
  project: TestProject,
  environment: DevEnvironment,
): ModuleGraphCollector {
  const data: SharedModuleGraphData = { modules: {}, rootsByTestFile: {} }
  const browser = project.config.browser.enabled
  const seen = new Map<EnvironmentModuleNode, string>()

  function addExternal(id: string) {
    data.modules[id] ??= { external: true, imports: [] }
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
    data.modules[id] = module
    module.imports = Array.from(mod.importedModules)
      .filter((i) => i.id && !i.id.includes('/vitest/dist/'))
      .map((m) => get(m))
      .filter((id) => id != null)
    return id
  }

  // graph roots of the test file including setup files
  function add(testFilePath: string): string[] {
    const roots = [testFilePath, ...project.config.setupFiles]
      .map((file) => get(environment.moduleGraph.getModuleById(file)))
      .filter((id) => id != null)
    data.rootsByTestFile[testFilePath] = roots
    return roots
  }

  return { data, add }
}

function clearId(id?: string | null) {
  return id?.replace(/\?v=\w+$/, '') || ''
}
