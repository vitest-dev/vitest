export interface ModuleDefinitionLocation {
  line: number
  column: number
}

export interface SourceModuleLocations {
  modules: ModuleDefinitionDiagnostic[]
  untracked: ModuleDefinitionDiagnostic[]
}

export interface ModuleDefinitionDiagnostic {
  start: ModuleDefinitionLocation
  end: ModuleDefinitionLocation
  startIndex: number
  endIndex: number
  rawUrl: string
  resolvedUrl: string
  resolvedId: string
}

export interface ModuleDefinitionDurationsDiagnostic extends ModuleDefinitionDiagnostic {
  selfTime: number
  totalTime: number
  transformTime?: number
  external?: boolean
  importer?: string
}

export interface UntrackedModuleDefinitionDiagnostic {
  url: string
  resolvedId: string
  resolvedUrl: string
  selfTime: number
  totalTime: number
  transformTime?: number
  external?: boolean
  importer?: string
}

export interface SourceModuleDiagnostic {
  modules: ModuleDefinitionDurationsDiagnostic[]
  untrackedModules: UntrackedModuleDefinitionDiagnostic[]
}
