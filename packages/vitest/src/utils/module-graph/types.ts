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

// What `getTestFileModuleGraph` reads, satisfied by live Vite objects and by the serialized shell.

// subset of `EnvironmentModuleNode`
export interface ModuleGraphQueryNode {
  id: string | null
  file: string | null
  importedModules: Set<ModuleGraphQueryNode>
}

// subset of `TestProject`
export interface ModuleGraphQueryProject {
  config: {
    setupFiles: string[]
    browser: { enabled: boolean }
  }
  browser?: { vite: { config: { cacheDir: string } } }
  _resolver: { wasExternalized: (id: string) => string | false }
}

// subset of `DevEnvironment`
export interface ModuleGraphQueryEnvironment {
  moduleGraph: { getModuleById: (id: string) => ModuleGraphQueryNode | undefined }
}
