import { pathToFileURL } from 'url'
import { isNodeBuiltin } from 'mlly'
import { normalizeModuleId } from 'vite-node/utils'
import { getWorkerState } from '../utils'
import type { Loader, Resolver } from '../types/loader'

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
