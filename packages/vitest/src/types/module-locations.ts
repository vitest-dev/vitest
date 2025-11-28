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
  url: string
  resolvedId: string
}

export interface ModuleDefinitionDurationsDiagnostic extends ModuleDefinitionDiagnostic {
  selfTime: number
  totalTime: number
  external?: boolean
}

export interface UntrackedModuleDefinitionDiagnostic {
  url: string
  resolvedId: string
  selfTime: number
  totalTime: number
  external?: boolean
}

export interface SourceModuleDiagnostic {
  modules: ModuleDefinitionDurationsDiagnostic[]
  untrackedModules: UntrackedModuleDefinitionDiagnostic[]
}
