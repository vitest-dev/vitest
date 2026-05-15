import type { DevEnvironment, EnvironmentModuleNode } from 'vite'
import type { TestProject } from '../node/project'

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
  browser?: SerializedEnvironmentModuleGraph
  external: [id: string, externalized: string][]
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

    modules.push([
      getIdIndex(id),
      getIdIndex(mod.file),
      getIdIndex(mod.url),
      importedIds,
    ])
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

export function serializeProjectModules(
  project: TestProject,
): SerializedProjectEnvironmentModules {
  const serialized: SerializedProjectEnvironmentModules = {
    environments: {},
    external: [],
  }

  Object.entries(project.vite.environments).forEach(([environmentName, environment]) => {
    serialized.environments[environmentName] = serializeEnvironmentModuleGraph(
      environment,
    )
  })

  if (project.browser?.vite.environments.client) {
    serialized.browser = serializeEnvironmentModuleGraph(
      project.browser.vite.environments.client,
    )
  }

  for (const [id, value] of project._resolver.externalizeCache.entries()) {
    if (typeof value === 'string') {
      serialized.external.push([id, value])
    }
  }

  return serialized
}
