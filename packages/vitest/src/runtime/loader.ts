import { pathToFileURL } from 'url'
import { normalizeModuleId } from 'vite-node/utils'
import type { Awaitable } from '../types'
import { getWorkerState } from '../utils'

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

interface Resolver {
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

interface Loader {
  (url: string, context: LoaderContext, next: Loader): Awaitable<LoaderResult>
}

export const resolve: Resolver = async (url, context, next) => {
  const { parentURL } = context
  if (!parentURL || !parentURL.includes('node_modules'))
    return next(url, context, next)

  const id = normalizeModuleId(url)
  const importer = normalizeModuleId(parentURL)
  const state = getWorkerState()
  const resolver = state?.rpc.resolveId
  if (resolver) {
    const resolved = await resolver(id, importer)
    if (resolved) {
      return {
        url: pathToFileURL(resolved.id).toString(),
      }
    }
  }
  return next(url, context, next)
}

export const load: Loader = (url, context, next) => {
  return next(url, context, next)
}
