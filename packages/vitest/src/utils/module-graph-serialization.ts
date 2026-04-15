import type { DevEnvironment, EnvironmentModuleNode } from 'vite'
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
    if (!mod.file) {
      continue
    }

    const importedIds: number[] = []
    for (const importedNode of mod.importedModules) {
      if (importedNode.id) {
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
  project: {
    vite: { environments: Record<string, DevEnvironment> }
    browser?: { vite: { environments: { client: DevEnvironment }; config: { cacheDir: string } } } | null
    _resolver: { externalizeCache: Map<string, string | false> }
  },
): SerializedProjectEnvironmentModules {
  const serialized: SerializedProjectEnvironmentModules = {
    environments: {},
    external: [],
  }
  Object.entries(project.vite.environments).forEach(([envName, env]) => {
    serialized.environments[envName] = serializeEnvironmentModuleGraph(env)
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
  for (const [idIdx, fileIdx, , importedIds] of serialized.modules) {
    const id = serialized.idTable[idIdx]
    files.set(id, serialized.idTable[fileIdx])
    adjacency.set(id, importedIds.map(i => serialized.idTable[i]))
  }
  return { adjacency, files }
}

function clearId(id: string): string {
  return id.replace(/\?v=\w+$/, '')
}

const emptyModuleGraph: ModuleGraphData = { graph: {}, externalized: [], inlined: [] }

export function deriveModuleGraphData(
  projectModules: SerializedProjectEnvironmentModules | undefined,
  testFilePath: string,
  browser?: boolean,
): ModuleGraphData {
  if (!projectModules) {
    return emptyModuleGraph
  }

  const externalCache = new Map<string, string>()
  for (const [id, externalized] of projectModules.external) {
    externalCache.set(id, externalized)
  }

  // Pick the right environment graph
  let serializedGraph: SerializedEnvironmentModuleGraph | undefined
  if (browser && projectModules.browser) {
    serializedGraph = projectModules.browser
  }
  else {
    // Find the environment that contains the test file
    for (const envName in projectModules.environments) {
      const env = projectModules.environments[envName]
      const hasFile = env.modules.some(
        ([idIdx]) => env.idTable[idIdx] === testFilePath,
      )
      if (hasFile) {
        serializedGraph = env
        break
      }
    }
  }

  if (!serializedGraph) {
    return emptyModuleGraph
  }

  const { adjacency, files } = deserializeGraph(serializedGraph)

  const graph: Record<string, string[]> = {}
  const externalized = new Set<string>()
  const inlined = new Set<string>()
  const seen = new Map<string, string>()
  const browserCacheDir = projectModules.browserCacheDir

  function visit(moduleId: string): string | undefined {
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

    const externalName = externalCache.get(id)
    if (externalName) {
      externalized.add(externalName)
      return externalName
    }

    if (browser && browserCacheDir) {
      const file = files.get(moduleId)
      if (file && file.includes(browserCacheDir)) {
        externalized.add(moduleId)
        return id
      }
    }

    inlined.add(id)
    const imports = adjacency.get(moduleId) || []
    const resolvedImports = imports
      .filter(i => !i.includes('/vitest/dist/'))
      .map(m => visit(m))
      .filter(Boolean) as string[]
    graph[id] = resolvedImports
    return id
  }

  visit(testFilePath)
  return {
    graph,
    externalized: Array.from(externalized),
    inlined: Array.from(inlined),
  }
}
