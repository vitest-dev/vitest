export interface ExternalizeOptions {
  external?: (string | RegExp)[]
  inline?: (string | RegExp)[]
  fallbackCJS?: boolean
}

export type FetchFunction = (id: string) => Promise<{ code?: string; externalize?: string }>

export interface ModuleCache {
  promise?: Promise<any>
  exports?: any
  code?: string
}

export interface ViteNodeRunnerOptions {
  fetchModule: FetchFunction
  root: string
  base?: string
  moduleCache?: Map<string, ModuleCache>
  interpretDefault?: boolean
  requestStubs?: Record<string, any>
}

export interface ViteNodeServerOptions {
  root: string
  deps?: ExternalizeOptions
  transformMode?: {
    ssr?: RegExp[]
    web?: RegExp[]
  }
}
