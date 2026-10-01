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
  defaultEnvironment?: string
  browserCacheDir?: string
  external: [id: string, externalized: string][]
  setupFiles: string[]
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
    adjacency.set(
      id,
      importedIds.map((i) => serialized.idTable[i]),
    )
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
  viteEnvironment?: string,
): ModuleGraphData {
  if (!projectModules) {
    return emptyModuleGraph
  }

  const externalCache = new Map(projectModules.external)
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
    if (moduleId === '\0vitest/browser' || moduleId.includes('plugin-vue:export-helper')) {
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
    if (browserCacheDir && file?.includes(browserCacheDir)) {
      externalized.add(moduleId)
      return id
    }

    inlined.add(id)
    const importedIds = adjacency.get(moduleId) || []
    graph[id] = importedIds
      .filter((i) => !i.includes('/vitest/dist/'))
      .map((i) => visit(i))
      .filter(Boolean) as string[]
    return id
  }

  visit(testFilePath)
  projectModules.setupFiles.forEach((setupFile) => visit(setupFile))

  return {
    graph,
    externalized: Array.from(externalized),
    inlined: Array.from(inlined),
  }
}
