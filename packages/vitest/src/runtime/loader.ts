import { pathToFileURL } from 'url'
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { dirname, extname, resolve as resolvePath } from 'pathe'
import { hasCJSSyntax, isNodeBuiltin } from 'mlly'
import { normalizeModuleId } from 'vite-node/utils'
import { getPackageInfo } from 'local-pkg'
import { getWorkerState } from '../utils'
import type { Loader, ResolveResult, Resolver } from '../types/loader'
import { ModuleFormat } from '../types/loader'
import type { ResolvedConfig } from '../types'

// TODO make "optimizer"-like crawling? - check "module", "exports" fields
// TODO clear cache before running tests, if version changed

// assume that module is bundled correctly/incorrectly alltogether
let pkgCache = new Map<string, { isPseudoESM: boolean; version: string; source?: string }>([
  ['/path/module', {
    version: '1.0.0',
    isPseudoESM: true,
  }] as const,
].sort(([a], [b]) => a.length - b.length))

let filePkg = new Map<string, string>()

const getModuleInfo = (url: string) => {
  while (url) {
    const dir = dirname(url)
    if (url === dir)
      return null
    url = dir
    const cached = pkgCache.get(url)
    if (cached)
      return cached
  }
  return null
}

const BUILTIN_EXTENSIONS = /* @__PURE__ */ new Set(['.mjs', '.cjs', '.node', '.wasm'])

const shouldCheckForPseudoESM = (url: string) => {
  if (url.startsWith('data:'))
    return false
  const extension = extname(url)
  if (BUILTIN_EXTENSIONS.has(extension))
    return false
  // skip .ts and other extensions, user should inline it
  return extension === '.js'
}

// TODO fix in mlly (add "}" as a possible first character: "}export default")
const ESM_RE = /([\s;}]|^)(import[\w,{}\s*]*from|import\s*['"*{]|export\b\s*(?:[*{]|default|class|type|function|const|var|let|async function)|import\.meta\b)/m
function hasESMSyntax(code: string) {
  return ESM_RE.test(code)
}

// TODO make URL relative to root
const isPseudoESM = async (url: string) => {
  const shouldCheck = shouldCheckForPseudoESM(url)
  if (!shouldCheck)
    return false
  const moduleInfo = getModuleInfo(url)
  if (moduleInfo)
    return moduleInfo.isPseudoESM
  const pkg = await getPackageInfo(url)
  if (!pkg)
    return false
  const pkgPath = dirname(pkg.packageJsonPath)
  let isPseudoESM = false
  let source: string | undefined
  if (pkg.packageJson.type !== 'module') {
    source = await readFile(url, 'utf8')
    isPseudoESM = (hasESMSyntax(source) && !hasCJSSyntax(source))
  }
  filePkg.set(url, pkgPath)
  pkgCache.set(pkgPath, {
    version: pkg.version,
    isPseudoESM,
    source,
  })
  return isPseudoESM
}

let cacheRead = false
const populateCache = async (config?: ResolvedConfig) => {
  const cacheDir = config?.cache && config.cache.dir
  if (!cacheDir)
    return // TODO recommend enabling/add option
  const loaderCacheFile = resolvePath(cacheDir, 'loader-data.json')
  if (!existsSync(loaderCacheFile)) {
    cacheRead = true
    return
  }
  try {
    const json = await readFile(loaderCacheFile, 'utf8')
    const { packages, files } = JSON.parse(json)
    pkgCache = new Map(packages)
    filePkg = new Map(files)
    cacheRead = true
  }
  catch {}
}

const saveCache = async (config?: ResolvedConfig) => {
  const cacheDir = config?.cache && config.cache.dir
  if (!cacheDir)
    return // TODO recommend enabling/add option
  const loaderCacheFile = resolvePath(cacheDir, 'loader-data.json')
  const json = JSON.stringify({
    packages: Array.from(pkgCache.entries()),
    files: Array.from(filePkg.entries()),
  })
  try {
    await writeFile(loaderCacheFile, json)
  }
  catch {}
}

function debounce(fn: (...args: any[]) => unknown, delay: number) {
  let timeoutID: NodeJS.Timeout
  return function (this: unknown, ...args: unknown[]) {
    globalThis.clearTimeout(timeoutID)
    timeoutID = globalThis.setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}

const debouncedSaveCache = debounce(() => saveCache().catch(() => {}), 1000)

// apply transformations only to libraries
// inline code proccessed by vite-node
// make Node pseudo ESM
export const resolve: Resolver = async (url, context, next) => {
  const { parentURL } = context
  const state = getWorkerState()
  const resolver = state?.rpc.resolveId

  if (!cacheRead)
    await populateCache(state?.config)

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

  const isModule = result.format !== 'module' && await isPseudoESM(filepath)

  if (isModule)
    result.format = ModuleFormat.Module
  return result
}

export const load: Loader = async (url, context, next) => {
  const result = await next(url, context, next)
  const modulePath = filePkg.get(url)
  const pkgData = result.format !== 'module' && modulePath && pkgCache.get(modulePath)
  if (pkgData) {
    const { source } = pkgData
    // TODO save before exiting process
    debouncedSaveCache()
    return {
      source: source || await readFile(url),
      format: ModuleFormat.Module,
    }
  }
  return result
}
