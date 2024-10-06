import type vm from 'node:vm'

// need to copy paste types for vm
// because they require latest @types/node which we don't bundle

interface ModuleEvaluateOptions {
  timeout?: vm.RunningScriptOptions['timeout'] | undefined
  breakOnSigint?: vm.RunningScriptOptions['breakOnSigint'] | undefined
}

type ModuleLinker = (
  specifier: string,
  referencingModule: VMModule,
  extra: { assert: object }
) => VMModule | Promise<VMModule>
type ModuleStatus =
  | 'unlinked'
  | 'linking'
  | 'linked'
  | 'evaluating'
  | 'evaluated'
  | 'errored'
export declare class VMModule {
  dependencySpecifiers: readonly string[]
  error: any
  identifier: string
  context: vm.Context
  namespace: object
  status: ModuleStatus
  evaluate(options?: ModuleEvaluateOptions): Promise<void>
  link(linker: ModuleLinker): Promise<void>
}
interface SyntheticModuleOptions {
  /**
   * String used in stack traces.
   * @default 'vm:module(i)' where i is a context-specific ascending index.
   */
  identifier?: string | undefined
  /**
   * The contextified object as returned by the `vm.createContext()` method, to compile and evaluate this module in.
   */
  context?: vm.Context | undefined
}
export declare class VMSyntheticModule extends VMModule {
  /**
   * Creates a new `SyntheticModule` instance.
   * @param exportNames Array of names that will be exported from the module.
   * @param evaluateCallback Called when the module is evaluated.
   */
  constructor(
    exportNames: string[],
    evaluateCallback: (this: VMSyntheticModule) => void,
    options?: SyntheticModuleOptions
  )
  /**
   * This method is used after the module is linked to set the values of exports.
   * If it is called before the module is linked, an `ERR_VM_MODULE_STATUS` error will be thrown.
   * @param name
   * @param value
   */
  setExport(name: string, value: any): void
}

export declare interface ImportModuleDynamically {
  (specifier: string, script: VMModule, importAssertions: object):
    | VMModule
    | Promise<VMModule>
}

export interface SourceTextModuleOptions {
  identifier?: string | undefined
  cachedData?: vm.ScriptOptions['cachedData'] | undefined
  context?: vm.Context | undefined
  lineOffset?: vm.BaseOptions['lineOffset'] | undefined
  columnOffset?: vm.BaseOptions['columnOffset'] | undefined
  /**
   * Called during evaluation of this module to initialize the `import.meta`.
   */
  initializeImportMeta?:
    | ((meta: ImportMeta, module: VMSourceTextModule) => void)
    | undefined
  importModuleDynamically?: ImportModuleDynamically
}
export declare class VMSourceTextModule extends VMModule {
  /**
   * Creates a new `SourceTextModule` instance.
   * @param code JavaScript Module code to parse
   */
  constructor(code: string, options?: SourceTextModuleOptions)
}
