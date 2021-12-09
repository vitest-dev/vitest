import { builtinModules, createRequire } from 'module'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, resolve } from 'path'
import vm from 'vm'
import type { TransformResult } from 'vite'

export interface ModuleCache {
  promise?: Promise<any>
  exports?: any
  transformResult?: TransformResult
}

export type FetchFunction = (id: string) => Promise<TransformResult | undefined | null>

export interface ExecuteOptions {
  root: string
  files: string[]
  fetch: FetchFunction
  inline: (string | RegExp)[]
  external: (string | RegExp)[]
  moduleCache: Map<string, ModuleCache>
}

const isWindows = process.platform === 'win32'

export const stubRequests: Record<string, any> = {
  '/@vite/client': {
    injectQuery: (id: string) => id,
    createHotContext() {
      return {
        accept: () => {},
        prune: () => {},
      }
    },
    updateStyle() {},
  },
}

export async function executeInViteNode({ moduleCache, root, files, fetch, inline, external }: ExecuteOptions) {
  const externaled = new Set<string>(builtinModules)
  const result = []
  for (const file of files)
    result.push(await cachedRequest(`/@fs/${slash(resolve(file))}`, []))
  return result

  async function directRequest(id: string, fsPath: string, callstack: string[]) {
    callstack = [...callstack, id]
    const request = async(dep: string) => {
      if (callstack.includes(dep)) {
        const cacheKey = toFilePath(dep, root)
        if (!moduleCache.get(cacheKey)?.exports)
          throw new Error(`Circular dependency detected\nStack:\n${[...callstack, dep].reverse().map(p => `- ${p}`).join('\n')}`)
        return moduleCache.get(cacheKey)!.exports
      }
      return cachedRequest(dep, callstack)
    }

    if (id in stubRequests)
      return stubRequests[id]

    const result = await fetch(id)
    if (!result)
      throw new Error(`failed to load ${id}`)

    // disambiguate the `<UNIT>:/` on windows: see nodejs/node#31710
    const url = pathToFileURL(fsPath).href
    const exports = {}

    setCache(fsPath, { transformResult: result, exports })

    const __filename = fileURLToPath(url)
    const context = {
      require: createRequire(url),
      __filename,
      __dirname: dirname(__filename),
      __vite_ssr_import__: request,
      __vite_ssr_dynamic_import__: request,
      __vite_ssr_exports__: exports,
      __vite_ssr_exportAll__: (obj: any) => exportAll(exports, obj),
      __vite_ssr_import_meta__: { url },
    }

    const fn = vm.runInThisContext(`async (${Object.keys(context).join(',')}) => { ${result.code} }`, {
      filename: fsPath,
      lineOffset: 0,
    })
    await fn(...Object.values(context))

    return exports
  }

  function setCache(id: string, mod: Partial<ModuleCache>) {
    if (!moduleCache.has(id))
      moduleCache.set(id, mod)
    else
      Object.assign(moduleCache.get(id), mod)
  }

  async function shouldExternalize(id: string) {
    for (const ex of inline) {
      if (typeof ex === 'string') {
        if (id.includes(`/node_modules/${ex}/`))
          return false
      }
      else {
        if (ex.test(id))
          return false
      }
    }
    for (const ex of external) {
      if (typeof ex === 'string') {
        if (id.includes(`/node_modules/${ex}/`))
          return true
      }
      else {
        if (ex.test(id))
          return true
      }
    }

    return id.includes('/node_modules/')
  }

  async function cachedRequest(rawId: string, callstack: string[]) {
    const id = normalizeId(rawId)

    if (externaled.has(id))
      return import(id)

    const fsPath = toFilePath(id, root)

    if (externaled.has(fsPath) || await shouldExternalize(fsPath)) {
      externaled.add(fsPath)
      // windows
      if (fsPath.match(/^\w:\//))
        return import(`/${fsPath}`)
      else
        return import(fsPath)
    }

    if (moduleCache.get(fsPath)?.promise)
      return moduleCache.get(fsPath)?.promise
    const promise = directRequest(id, fsPath, callstack)
    setCache(fsPath, { promise })
    return await promise
  }

  function exportAll(exports: any, sourceModule: any) {
    // eslint-disable-next-line no-restricted-syntax
    for (const key in sourceModule) {
      if (key !== 'default') {
        try {
          Object.defineProperty(exports, key, {
            enumerable: true,
            configurable: true,
            get() { return sourceModule[key] },
          })
        }
        catch (_err) { }
      }
    }
  }
}

export function normalizeId(id: string): string {
  // Virtual modules start with `\0`
  if (id && id.startsWith('/@id/__x00__'))
    id = `\0${id.slice('/@id/__x00__'.length)}`
  if (id && id.startsWith('/@id/'))
    id = id.slice('/@id/'.length)
  if (id.startsWith('__vite-browser-external:'))
    id = id.slice('__vite-browser-external:'.length)
  if (id.startsWith('node:'))
    id = id.slice('node:'.length)
  return id
}

export function toFilePath(id: string, root: string): string {
  id = slash(id)
  let absolute = id.startsWith('/@fs/')
    ? id.slice(4)
    : id.startsWith(dirname(root))
      ? id
      : id.startsWith('/')
        ? slash(resolve(root, id.slice(1)))
        : id

  if (absolute.startsWith('//'))
    absolute = absolute.slice(1)

  // disambiguate the `<UNIT>:/` on windows: see nodejs/node#31710
  return isWindows && absolute.startsWith('/')
    ? pathToFileURL(absolute.slice(1)).href
    : absolute
}

function slash(path: string) {
  return path.replace(/\\/g, '/')
}
