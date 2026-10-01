import type { DevEnvironment, EnvironmentModuleNode } from 'vite'
import type { TestProject } from '../node/project'
import type { ModuleGraphData } from '../types/general'
import type { ModuleGraphEnvironment, ModuleGraphNode, ModuleGraphProject } from './graph'
import { getEnvironmentModuleGraph, normalizeId } from './graph'

export type SerializedEnvironmentModuleNode = [
  id: number,
  file: number,
  url: number,
  importedIds: number[],
]

export interface SerializedEnvironmentModuleGraph {
  idTable: string[]
  modules: SerializedEnvironmentModuleNode[]
}

export interface SerializedProjectEnvironmentModules {
  environments: {
    [environmentName: string]: SerializedEnvironmentModuleGraph
  }
  defaultEnvironment?: string
  browserCacheDir?: string
  external: [id: string, externalized: string][]
  setupFiles: string[]
}

export function serializeEnvironmentModuleGraph(
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

export function deserializeEnvironmentModuleGraph(
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

export function serializeProjectModules(project: TestProject): SerializedProjectEnvironmentModules {
  const serialized: SerializedProjectEnvironmentModules = {
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

const emptyModuleGraph: ModuleGraphData = {
  graph: {},
  externalized: [],
  inlined: [],
}

// minimal project/environment shell so the static html report can run getEnvironmentModuleGraph
function createModuleGraphShell(
  projectModules: SerializedProjectEnvironmentModules,
  serialized: SerializedEnvironmentModuleGraph,
): { project: ModuleGraphProject; environment: ModuleGraphEnvironment } {
  const nodes = new Map<string, ModuleGraphNode>()
  for (const [id, file] of serialized.modules) {
    nodes.set(serialized.idTable[id], {
      id: serialized.idTable[id],
      file: serialized.idTable[file],
      importedModules: new Set(),
    })
  }
  for (const [id, _file, _url, importedIds] of serialized.modules) {
    const node = nodes.get(serialized.idTable[id])!
    for (const importedId of importedIds) {
      const importedNode = nodes.get(serialized.idTable[importedId])
      if (importedNode) {
        node.importedModules.add(importedNode)
      }
    }
  }

  const external = new Map(projectModules.external)
  const browserCacheDir = projectModules.browserCacheDir
  return {
    project: {
      config: {
        setupFiles: projectModules.setupFiles,
        browser: { enabled: browserCacheDir != null },
      },
      browser:
        browserCacheDir != null ? { vite: { config: { cacheDir: browserCacheDir } } } : undefined,
      _resolver: {
        wasExternalized: (id) => external.get(normalizeId(id)) ?? false,
      },
    },
    environment: {
      moduleGraph: { getModuleById: (id) => nodes.get(id) },
    },
  }
}

export function deriveModuleGraphData(
  projectModules: SerializedProjectEnvironmentModules | undefined,
  testFilePath: string,
  viteEnvironment?: string,
): ModuleGraphData {
  if (!projectModules) {
    return emptyModuleGraph
  }

  let serializedGraph: SerializedEnvironmentModuleGraph | undefined
  const environmentName = viteEnvironment || projectModules.defaultEnvironment
  if (environmentName) {
    serializedGraph = projectModules.environments[environmentName]
  } else {
    for (const environmentName in projectModules.environments) {
      const environment = projectModules.environments[environmentName]
      if (environment.modules.some(([idIndex]) => environment.idTable[idIndex] === testFilePath)) {
        serializedGraph = environment
        break
      }
    }
  }

  if (!serializedGraph) {
    return emptyModuleGraph
  }

  const { project, environment } = createModuleGraphShell(projectModules, serializedGraph)
  return getEnvironmentModuleGraph(project, environment, testFilePath)
}
