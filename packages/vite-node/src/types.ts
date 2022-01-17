export interface ExternalizeOptions {
  external?: (string | RegExp)[]
  inline?: (string | RegExp)[]
  fallbackCJS?: boolean
}

export type FetchFunction = (id: string) => Promise<{ code?: string; externalize?: string }>
export type ResolveIdFunction = (id: string, importer?: string) => Promise<ViteNodeResolveId | null>

export interface ModuleCache {
  promise?: Promise<any>
  exports?: any
  code?: string
}

export interface ViteNodeRunnerOptions {
  fetchModule: FetchFunction
  resolveId: ResolveIdFunction
  root: string
  base?: string
  moduleCache?: Map<string, ModuleCache>
  interpretDefault?: boolean
  requestStubs?: Record<string, any>
}

export interface ViteNodeResolveId {
  external?: boolean | 'absolute' | 'relative'
  id: string
  meta?: Record<string, any> | null
  moduleSideEffects?: boolean | 'no-treeshake' | null
  syntheticNamedExports?: boolean | string | null
}

export interface ViteNodeServerOptions {
  deps?: ExternalizeOptions
  transformMode?: {
    ssr?: RegExp[]
    web?: RegExp[]
  }
}
