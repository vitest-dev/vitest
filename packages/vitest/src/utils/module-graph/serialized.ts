import type { ModuleGraphData } from '../../types/general'
import type {
  ModuleGraphEnvironment,
  ModuleGraphNode,
  ModuleGraphProject,
  SerializedEnvironmentModuleGraph,
  SerializedProjectModules,
} from './types'
import { getTestFileModuleGraph } from './query'

const EMPTY_MODULE_GRAPH: ModuleGraphData = {
  graph: {},
  externalized: [],
  inlined: [],
}

export function getSerializedTestFileModuleGraph(
  projectModules: SerializedProjectModules | undefined,
  testFilePath: string,
  viteEnvironment?: string,
): ModuleGraphData {
  if (!projectModules) {
    return EMPTY_MODULE_GRAPH
  }

  let serializedGraph: SerializedEnvironmentModuleGraph | undefined
  const environmentName = viteEnvironment || projectModules.project.defaultEnvironment
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
    return EMPTY_MODULE_GRAPH
  }

  const { project, environment } = createModuleGraphShell(projectModules, serializedGraph)
  return getTestFileModuleGraph(project, environment, testFilePath)
}

// minimal project/environment shell so the static html report can run getTestFileModuleGraph
function createModuleGraphShell(
  projectModules: SerializedProjectModules,
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
  const { setupFiles, browserCacheDir } = projectModules.project
  return {
    project: {
      config: {
        setupFiles,
        browser: { enabled: browserCacheDir != null },
      },
      browser:
        browserCacheDir != null ? { vite: { config: { cacheDir: browserCacheDir } } } : undefined,
      _resolver: {
        wasExternalized: (id) => external.get(id) ?? false,
      },
    },
    environment: {
      moduleGraph: { getModuleById: (id) => nodes.get(id) },
    },
  }
}
