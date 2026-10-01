
export interface SerializedProjectModules {
  environments: {
    [environmentName: string]: SerializedEnvironmentModuleGraph
  }
  external: [id: string, externalized: string][]
  project: {
    setupFiles: string[]
    defaultEnvironment?: string
    browserCacheDir?: string
  }
}

export interface SerializedEnvironmentModuleGraph {
  idTable: string[]
  modules: SerializedEnvironmentModuleNode[]
}

export type SerializedEnvironmentModuleNode = [
  id: number,
  file: number,
  url: number,
  importedIds: number[],
]

export interface ModuleGraphProject {
  config: {
    setupFiles: string[]
    browser: { enabled: boolean }
  }
  browser?: { vite: { config: { cacheDir: string } } }
  _resolver: { wasExternalized: (id: string) => string | false }
}

export interface ModuleGraphEnvironment {
  moduleGraph: { getModuleById: (id: string) => ModuleGraphNode | undefined }
}

export interface ModuleGraphNode {
  id: string | null
  file: string | null
  importedModules: Set<ModuleGraphNode>
}
