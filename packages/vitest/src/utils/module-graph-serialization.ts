import type { DevEnvironment, EnvironmentModuleNode } from 'vite'
import type { TestProject } from '../node/project'
import type { ModuleGraphData } from '../types/general'

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
    setupFiles: project.config.setupFiles,
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
    serialized.browserCacheDir = project.browser.vite.config.cacheDir
  }

  for (const [id, value] of project._resolver.externalizeCache.entries()) {
    if (typeof value === 'string') {
      serialized.external.push([id, value])
    }
  }

  return serialized
}

interface DeserializedGraph {
  adjacency: Map<string, string[]>
  files: Map<string, string>
}

function deserializeGraph(serialized: SerializedEnvironmentModuleGraph): DeserializedGraph {
  const adjacency = new Map<string, string[]>()
  const files = new Map<string, string>()

  for (const [idIndex, fileIndex, _urlIndex, importedIds] of serialized.modules) {
    const id = serialized.idTable[idIndex]
    files.set(id, serialized.idTable[fileIndex])
    adjacency.set(id, importedIds.map(i => serialized.idTable[i]))
  }

  return { adjacency, files }
}

function clearId(id?: string | null) {
  return id?.replace(/\?v=\w+$/, '') || ''
}

const emptyModuleGraph: ModuleGraphData = {
  graph: {},
  externalized: [],
  inlined: [],
}

// Static HTML reports cannot call getModuleGraph because they only have the
// serialized environment graph. Keep this traversal behavior aligned with
// packages/vitest/src/utils/graph.ts#getModuleGraph; if the two paths drift
// further, consider extracting a shared traversal over a small graph adapter.
export function deriveModuleGraphData(
  projectModules: SerializedProjectEnvironmentModules | undefined,
  testFilePath: string,
  browser = false,
): ModuleGraphData {
  if (!projectModules) {
    return emptyModuleGraph
  }

  const externalCache = new Map(projectModules.external)
  let serializedGraph: SerializedEnvironmentModuleGraph | undefined

  if (browser && projectModules.browser) {
    serializedGraph = projectModules.browser
  }
  else {
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

  const graph: Record<string, string[]> = {}
  const externalized = new Set<string>()
  const inlined = new Set<string>()
  const seen = new Map<string, string>()
  const browserCacheDir = projectModules.browserCacheDir
  const { adjacency, files } = deserializeGraph(serializedGraph)

  function visit(moduleId?: string | null) {
    if (!moduleId) {
      return
    }
    if (
      moduleId === '\0vitest/browser'
      || moduleId.includes('plugin-vue:export-helper')
    ) {
      return
    }
    if (seen.has(moduleId)) {
      return seen.get(moduleId)
    }

    const id = clearId(moduleId)
    seen.set(moduleId, id)

    if (id.startsWith('__vite-browser-external:')) {
      const external = id.slice('__vite-browser-external:'.length)
      externalized.add(external)
      return external
    }

    const external = externalCache.get(id)
    if (typeof external === 'string') {
      externalized.add(external)
      return external
    }

    const file = files.get(moduleId)
    if (browser && browserCacheDir && file?.includes(browserCacheDir)) {
      externalized.add(moduleId)
      return id
    }

    inlined.add(id)
    const importedIds = adjacency.get(moduleId) || []
    graph[id] = importedIds
      .filter(i => !i.includes('/vitest/dist/'))
      .map(i => visit(i))
      .filter(Boolean) as string[]
    return id
  }

  visit(testFilePath)
  projectModules.setupFiles.forEach(setupFile => visit(setupFile))

  return {
    graph,
    externalized: Array.from(externalized),
    inlined: Array.from(inlined),
  }
}
