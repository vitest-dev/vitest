import { pathToFileURL } from 'url'
import { readFile } from 'fs/promises'
import { hasESMSyntax, isNodeBuiltin } from 'mlly'
import { normalizeModuleId } from 'vite-node/utils'
import { getWorkerState } from '../utils'
import type { Loader, ResolveResult, Resolver } from '../types/loader'
import { ModuleFormat } from '../types/loader'

interface ContextCache {
  isESM: boolean
  source: string
}

const cache = new Map<string, ContextCache>()

// apply transformations only to libraries
// inline code preccessed by vite-node
export const resolve: Resolver = async (url, context, next) => {
  const { parentURL } = context
  if (!parentURL || !parentURL.includes('node_modules') || isNodeBuiltin(url))
    return next(url, context, next)

  const id = normalizeModuleId(url)
  const importer = normalizeModuleId(parentURL)
  const state = getWorkerState()
  const resolver = state?.rpc.resolveId
  if (resolver) {
    const resolved = await resolver(id, importer)
    if (resolved) {
      const filepath = pathToFileURL(resolved.id).toString()
      const result: ResolveResult = {
        url: filepath,
        shortCircuit: true,
      }
      const source = cache.get(resolved.id)?.source ?? await readFile(resolved.id, 'utf8')
      const isESM = hasESMSyntax(source)
      if (isESM) {
        result.format = ModuleFormat.Module
        cache.set(filepath, { isESM: true, source })
      }
      return result
    }
  }
  return next(url, context, next)
}

export const load: Loader = async (url, context, next) => {
  const result = await next(url, context, next)
  const cached = cache.get(url)
  if (cached?.isESM && result.format !== 'module') {
    return {
      source: cached.source,
      format: ModuleFormat.Module,
    }
  }
  return result
}
