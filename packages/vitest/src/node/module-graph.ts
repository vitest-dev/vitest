import type { DevEnvironment, EnvironmentModuleNode } from 'vite'
import type { ModuleGraphData } from '../types/general'
import type {
  SerializedEnvironmentModuleGraph,
  SerializedEnvironmentModuleNode,
  SerializedProjectModules,
} from '../utils/module-graph/types'
import type { Vitest } from './core'
import type { TestProject } from './project'
import { getTestFileEnvironment } from '../utils/environments'
import { getTestFileModuleGraph } from '../utils/module-graph/query'

export async function getModuleGraph(
  ctx: Vitest,
  projectName: string,
  testFilePath: string,
  viteEnvironment?: string,
): Promise<ModuleGraphData> {
  const project = ctx.getProjectByName(projectName)
  const browser = project.config.browser.enabled

  let environment: DevEnvironment | undefined

  if (viteEnvironment) {
    environment = project.vite.environments[viteEnvironment]
  } else {
    environment =
      project.config.experimental.viteModuleRunner === false
        ? project.vite.environments.__vitest__
        : getTestFileEnvironment(project, testFilePath, browser)
  }

  if (!environment) {
    throw new Error(`Cannot find environment for ${testFilePath}`)
  }
  return getTestFileModuleGraph(project, environment, testFilePath)
}

export function serializeProjectModules(project: TestProject): SerializedProjectModules {
  const serialized: SerializedProjectModules = {
    environments: {},
    external: [],
    setupFiles: project.config.setupFiles,
  }

  Object.entries(project.vite.environments).forEach(([environmentName, environment]) => {
    serialized.environments[environmentName] = serializeEnvironmentModuleGraph(environment)
  })

  if (project.config.experimental.viteModuleRunner === false) {
    serialized.defaultEnvironment = '__vitest__'
  } else if (project.config.browser.enabled) {
    serialized.defaultEnvironment = 'client'
    serialized.browserCacheDir = project.browser?.vite.config.cacheDir
  }

  for (const [id, value] of project._resolver.externalizeCache.entries()) {
    if (typeof value === 'string') {
      serialized.external.push([id, value])
    }
  }

  return serialized
}

export function restoreProjectModules(
  project: TestProject,
  serialized: SerializedProjectModules,
): void {
  serialized.external.forEach(([id, externalized]) => {
    project._resolver.externalizeCache.set(id, externalized)
  })

  Object.entries(serialized.environments).forEach(([environmentName, moduleGraph]) => {
    const environment = project.vite.environments[environmentName]
    deserializeEnvironmentModuleGraph(environment, moduleGraph)
  })
}

function serializeEnvironmentModuleGraph(
  environment: DevEnvironment,
): SerializedEnvironmentModuleGraph {
  const idTable: string[] = []
  const idMap = new Map<string, number>()

  const getIdIndex = (id: string) => {
    const existing = idMap.get(id)
    if (existing != null) {
      return existing
    }
    const next = idTable.length
    idMap.set(id, next)
    idTable.push(id)
    return next
  }

  const modules: SerializedEnvironmentModuleNode[] = []
  for (const [id, mod] of environment.moduleGraph.idToModuleMap.entries()) {
    // Vite can generate module with `file = ""` for module id "#..."
    // when the actual module doesn't exist (e.g. resolve failure or mocked module)
    if (mod.file == null) {
      continue
    }

    const importedIds: number[] = []
    for (const importedNode of mod.importedModules) {
      if (importedNode.id !== null) {
        importedIds.push(getIdIndex(importedNode.id))
      }
    }

    modules.push([getIdIndex(id), getIdIndex(mod.file), getIdIndex(mod.url), importedIds])
  }

  return {
    idTable,
    modules,
  }
}

function deserializeEnvironmentModuleGraph(
  environment: DevEnvironment,
  serialized: SerializedEnvironmentModuleGraph,
): void {
  const nodesById = new Map<string, EnvironmentModuleNode>()

  serialized.modules.forEach(([id, file, url]) => {
    const moduleId = serialized.idTable[id]
    const filePath = serialized.idTable[file]
    const urlPath = serialized.idTable[url]
    // `createFileOnlyEntry('')` normalizes the file to ".". This keeps
    // the graph usable, but doesn't perfectly round-trip Vite's `file = ""`
    // nodes for ids like "#...".
    // We may just do moduleNode.file = filePath in the future.
    const moduleNode = environment.moduleGraph.createFileOnlyEntry(filePath)
    moduleNode.url = urlPath
    moduleNode.id = moduleId
    moduleNode.transformResult = {
      // print error checks that transformResult is set
      code: ' ',
      map: null,
    }
    environment.moduleGraph.idToModuleMap.set(moduleId, moduleNode)
    nodesById.set(moduleId, moduleNode)
  })

  serialized.modules.forEach(([id, _file, _url, importedIds]) => {
    const moduleId = serialized.idTable[id]
    const moduleNode = nodesById.get(moduleId)!
    importedIds.forEach((importedIdIndex) => {
      const importedId = serialized.idTable[importedIdIndex]
      const importedNode = nodesById.get(importedId)!
      moduleNode.importedModules.add(importedNode)
      importedNode.importers.add(moduleNode)
    })
  })
}
