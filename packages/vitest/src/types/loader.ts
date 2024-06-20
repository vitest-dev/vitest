import type { Awaitable } from './general'

interface ModuleContext extends Record<string, unknown> {
  conditions: string[]
  parentURL?: string
}

export enum ModuleFormat {
  Builtin = 'builtin',
  Commonjs = 'commonjs',
  Json = 'json',
  Module = 'module',
  Wasm = 'wasm',
}

export interface ResolveResult {
  url: string
  shortCircuit?: boolean
  format?: ModuleFormat
}

export interface Resolver {
  (
    url: string,
    context: ModuleContext,
    next: Resolver
  ): Awaitable<ResolveResult>
}

interface LoaderContext extends Record<string, any> {
  format: ModuleFormat
  importAssertions: Record<string, string>
}

interface LoaderResult {
  format: ModuleFormat
  shortCircuit?: boolean
  source: string | ArrayBuffer | SharedArrayBuffer | Uint8Array
}

export interface Loader {
  (url: string, context: LoaderContext, next: Loader): Awaitable<LoaderResult>
}
