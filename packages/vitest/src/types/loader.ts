import type { Awaitable } from './general'

interface ModuleContext {
  conditions: string[]
  parentURL?: string
}

enum ModuleFormat {
  Builtin = 'builtin',
  Commonjs = 'commonjs',
  Json = 'json',
  Module = 'module',
  Wasm = 'wasm',
}

interface ResolveResult {
  url: string
  format?: ModuleFormat
}

export interface Resolver {
  (url: string, context: ModuleContext, next: Resolver): Awaitable<ResolveResult>
}

interface LoaderContext {
  format: ModuleFormat
  importAssertions: Record<string, string>
}

interface LoaderResult {
  format: ModuleFormat
  source: string | ArrayBuffer | SharedArrayBuffer | Uint8Array
}

export interface Loader {
  (url: string, context: LoaderContext, next: Loader): Awaitable<LoaderResult>
}
