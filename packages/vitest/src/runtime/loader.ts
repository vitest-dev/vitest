import { pathToFileURL } from 'url'
import { readFile } from 'fs/promises'
import { isNodeBuiltin } from 'mlly'
import { normalizeModuleId } from 'vite-node/utils'
import { getWorkerState } from '../utils'
import type { Loader, ResolveResult, Resolver } from '../types/loader'
import { ModuleFormat } from '../types/loader'

// TODO fix in mlly (add "}" as a possible first character: "}export default")
const ESM_RE = /([\s;}]|^)(import[\w,{}\s*]*from|import\s*['"*{]|export\b\s*(?:[*{]|default|class|type|function|const|var|let|async function)|import\.meta\b)/m
function hasESMSyntax(code: string) {
  return ESM_RE.test(code)
}

interface ContextCache {
  isPseudoESM: boolean
  source: string
}

const cache = new Map<string, ContextCache>()

// apply transformations only to libraries
// inline code preccessed by vite-node
// make Node understand "module" field and pseudo ESM
export const resolve: Resolver = async (url, context, next) => {
  const { parentURL } = context
  const state = getWorkerState()
  const resolver = state?.rpc.resolveId

  if (!parentURL || isNodeBuiltin(url) || !resolver)
    return next(url, context, next)

  const id = normalizeModuleId(url)
  const importer = normalizeModuleId(parentURL)
  const resolved = await resolver(id, importer)

  let result: ResolveResult
  let filepath: string
  if (resolved) {
    const resolvedUrl = pathToFileURL(resolved.id).toString()
    filepath = resolved.id
    result = {
      url: resolvedUrl,
      shortCircuit: true,
    }
  }
  else {
    const { url: resolvedUrl, format } = await next(url, context, next)
    filepath = new URL(resolvedUrl).pathname
    result = {
      url: resolvedUrl,
      format,
      shortCircuit: true,
    }
  }

  const isReadable = result.url.startsWith('file://')

  const source = isReadable && result.format !== 'module' && (cache.get(result.url)?.source ?? await readFile(filepath, 'utf8'))
  const isPseudoESM = cache.get(result.url)?.isPseudoESM ?? (source && hasESMSyntax(source))
  if (typeof source === 'string')
    cache.set(result.url, { isPseudoESM: isPseudoESM || false, source })
  if (isPseudoESM)
    result.format = ModuleFormat.Module
  return result
}

export const load: Loader = async (url, context, next) => {
  const result = await next(url, context, next)
  const cached = cache.get(url)
  if (cached?.isPseudoESM && result.format !== 'module') {
    return {
      source: cached.source,
      format: ModuleFormat.Module,
    }
  }
  return result
}
