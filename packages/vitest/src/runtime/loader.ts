import { pathToFileURL } from 'url'
import { readFile } from 'fs/promises'
import { hasCJSSyntax, isNodeBuiltin } from 'mlly'
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

const getPotentialSource = async (filepath: string, result: ResolveResult) => {
  if (!result.url.startsWith('file://') || result.format === 'module')
    return null
  let source = cache.get(result.url)?.source
  if (source == null)
    source = await readFile(filepath, 'utf8')
  return source
}

const detectESM = (url: string, source: string | null) => {
  const cached = cache.get(url)
  if (cached)
    return cached.isPseudoESM
  if (!source)
    return false
  return (hasESMSyntax(source) && !hasCJSSyntax(source))
}

// apply transformations only to libraries
// inline code proccessed by vite-node
// make Node pseudo ESM
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

  const source = await getPotentialSource(filepath, result)
  const isPseudoESM = detectESM(result.url, source)
  if (typeof source === 'string')
    cache.set(result.url, { isPseudoESM, source })
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
