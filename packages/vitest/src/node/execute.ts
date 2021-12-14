import { builtinModules, createRequire } from 'module'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, resolve } from 'path'
import vm from 'vm'
import type { TransformResult } from 'vite'
import type { ModuleCache } from '../types'
import { slash } from '../utils'

export type FetchFunction = (id: string) => Promise<TransformResult | undefined | null>

export interface ExecuteOptions {
  root: string
  files: string[]
  fetch: FetchFunction
  interpretDefault: boolean
  inline: (string | RegExp)[]
  external: (string | RegExp)[]
  moduleCache: Map<string, ModuleCache>
}

const defaultInline = [
  'vitest/dist',
  '@vue',
  '@vueuse',
  'vue-demi',
  'vue',
  /virtual:/,
  /\.ts$/,
  /\/esm\/.*\.js$/,
  /\.(es|esm|esm-browser|esm-bundler|es6).js$/,
]
const depsExternal = [
  /\.cjs.js$/,
]

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

export async function interpretedImport(path: string, interpretDefault: boolean) {
  const mod = await import(path)

  if (interpretDefault && '__esModule' in mod && 'default' in mod) {
    const defaultExport = mod.default
    if (!('default' in defaultExport)) {
      Object.defineProperty(defaultExport, 'default', {
        enumerable: true,
        configurable: true,
        get() { return defaultExport },
      })
    }
    return defaultExport
  }

  return mod
}

let SOURCEMAPPING_URL = 'sourceMa'
SOURCEMAPPING_URL += 'ppingURL'

export async function withInlineSourcemap(result: TransformResult) {
  const { code, map } = result

  if (code.includes(`${SOURCEMAPPING_URL}=`))
    return result

  if (map)
    result.code = `${code}\n\n//# ${SOURCEMAPPING_URL}=data:application/json;charset=utf-8;base64,${Buffer.from(JSON.stringify(map), 'utf-8').toString('base64')}`

  return result
}

export async function executeInViteNode(options: ExecuteOptions) {
  const { moduleCache, root, files, fetch } = options

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

    // this doesnt work if disable trnsform plugin
    // since it doesnt process inner files, I guess
    // ->
    //    ->
    //       -> import {} from './mocked' is not returning __mocks__
    //
    // const dir = dirname(fsPath)
    // const baseId = basename(fsPath)
    // const mockFile = join(dir, '__mocks__', baseId)

    // if (existsSync(mockFile)) {
    //   const idDir = dirname(id)
    //   fsPath = mockFile
    //   id = join(idDir, '__mocks__', baseId)
    // }

    const result = await fetch(id)
    if (!result)
      throw new Error(`failed to load ${id}`)

    if (process.env.NODE_V8_COVERAGE)
      withInlineSourcemap(result)

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

    const fn = vm.runInThisContext(`async (${Object.keys(context).join(',')})=>{${result.code}\n}`, {
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

  async function cachedRequest(rawId: string, callstack: string[]) {
    const id = normalizeId(rawId)

    if (externaled.has(id))
      return interpretedImport(id, options.interpretDefault)

    const fsPath = toFilePath(id, root)

    const importPath = patchWindowsImportPath(fsPath)
    if (externaled.has(importPath) || await shouldExternalize(importPath, options)) {
      externaled.add(importPath)
      return interpretedImport(importPath, options.interpretDefault)
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

export async function shouldExternalize(id: string, config: Pick<ExecuteOptions, 'inline' | 'external'>) {
  if (matchExternalizePattern(id, config.inline))
    return false
  if (matchExternalizePattern(id, config.external))
    return true

  if (matchExternalizePattern(id, depsExternal))
    return true
  if (matchExternalizePattern(id, defaultInline))
    return false

  return id.includes('/node_modules/') // && await isValidNodeImport(id)
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

function matchExternalizePattern(id: string, patterns: (string | RegExp)[]) {
  for (const ex of patterns) {
    if (typeof ex === 'string') {
      if (id.includes(`/node_modules/${ex}/`))
        return true
    }
    else {
      if (ex.test(id))
        return true
    }
  }
  return false
}

function patchWindowsImportPath(path: string) {
  if (path.match(/^\w:\//))
    return `/${path}`
  else
    return path
}
