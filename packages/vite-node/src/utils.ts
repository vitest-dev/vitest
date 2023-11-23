import { fileURLToPath, pathToFileURL } from 'node:url'
import { builtinModules } from 'node:module'
import { existsSync, promises as fsp } from 'node:fs'
import { dirname, join, resolve } from 'pathe'
import type { Arrayable, Nullable } from './types'

export const isWindows = process.platform === 'win32'

const drive = isWindows ? process.cwd()[0] : null
const driveOpposite = drive
  ? (drive === drive.toUpperCase()
      ? drive.toLowerCase()
      : drive.toUpperCase())
  : null
const driveRegexp = drive ? new RegExp(`(?:^|/@fs/)${drive}(\:[\\/])`) : null
const driveOppositeRegext = driveOpposite ? new RegExp(`(?:^|/@fs/)${driveOpposite}(\:[\\/])`) : null

export function slash(str: string) {
  return str.replace(/\\/g, '/')
}

export const VALID_ID_PREFIX = '/@id/'

export function normalizeRequestId(id: string, base?: string): string {
  if (base && id.startsWith(withTrailingSlash(base)))
    id = `/${id.slice(base.length)}`

  // keep drive the same as in process cwd
  if (driveRegexp && !driveRegexp?.test(id) && driveOppositeRegext?.test(id))
    id = id.replace(driveOppositeRegext, `${drive}$1`)

  return id
    .replace(/^\/@id\/__x00__/, '\0') // virtual modules start with `\0`
    .replace(/^\/@id\//, '')
    .replace(/^__vite-browser-external:/, '')
    .replace(/^file:/, '')
    .replace(/^\/+/, '/') // remove duplicate leading slashes
    .replace(/\?v=\w+/, '?') // remove ?v= query
    .replace(/&v=\w+/, '') // remove &v= query
    .replace(/\?t=\w+/, '?') // remove ?t= query
    .replace(/&t=\w+/, '') // remove &t= query
    .replace(/\?import/, '?') // remove ?import query
    .replace(/&import/, '') // remove &import query
    .replace(/\?&/, '?') // replace ?& with just ?
    .replace(/\?+$/, '') // remove end query mark
}

export const queryRE = /\?.*$/s
export const hashRE = /#.*$/s

export function cleanUrl(url: string): string {
  return url.replace(hashRE, '').replace(queryRE, '')
}

const internalRequests = [
  '@vite/client',
  '@vite/env',
]

const internalRequestRegexp = new RegExp(`^/?(${internalRequests.join('|')})$`)

export function isInternalRequest(id: string): boolean {
  return internalRequestRegexp.test(id)
}

const prefixedBuiltins = new Set([
  'node:test',
])

const builtins = new Set([
  ...builtinModules,
  'assert/strict',
  'diagnostics_channel',
  'dns/promises',
  'fs/promises',
  'path/posix',
  'path/win32',
  'readline/promises',
  'stream/consumers',
  'stream/promises',
  'stream/web',
  'timers/promises',
  'util/types',
  'wasi',
])

export function normalizeModuleId(id: string) {
  // unique id that is not available as "test"
  if (prefixedBuiltins.has(id))
    return id
  return id
    .replace(/\\/g, '/')
    .replace(/^\/@fs\//, isWindows ? '' : '/')
    .replace(/^file:\//, '/')
    .replace(/^node:/, '')
    .replace(/^\/+/, '/')
}

export function isPrimitive(v: any) {
  return v !== Object(v)
}

export function toFilePath(id: string, root: string): { path: string; exists: boolean } {
  let { absolute, exists } = (() => {
    if (id.startsWith('/@fs/'))
      return { absolute: id.slice(4), exists: true }
    // check if /src/module.js -> <root>/src/module.js
    if (!id.startsWith(withTrailingSlash(root)) && id.startsWith('/')) {
      const resolved = resolve(root, id.slice(1))
      if (existsSync(cleanUrl(resolved)))
        return { absolute: resolved, exists: true }
    }
    else if (id.startsWith(withTrailingSlash(root)) && existsSync(cleanUrl(id))) {
      return { absolute: id, exists: true }
    }
    return { absolute: id, exists: false }
  })()

  if (absolute.startsWith('//'))
    absolute = absolute.slice(1)

  // disambiguate the `<UNIT>:/` on windows: see nodejs/node#31710
  return {
    path: (isWindows && absolute.startsWith('/'))
      ? slash(fileURLToPath(pathToFileURL(absolute.slice(1)).href))
      : absolute,
    exists,
  }
}

const NODE_BUILTIN_NAMESPACE = 'node:'
export function isNodeBuiltin(id: string): boolean {
  if (prefixedBuiltins.has(id))
    return true
  return builtins.has(
    id.startsWith(NODE_BUILTIN_NAMESPACE)
      ? id.slice(NODE_BUILTIN_NAMESPACE.length)
      : id,
  )
}

/**
 * Convert `Arrayable<T>` to `Array<T>`
 *
 * @category Array
 */
export function toArray<T>(array?: Nullable<Arrayable<T>>): Array<T> {
  if (array === null || array === undefined)
    array = []

  if (Array.isArray(array))
    return array

  return [array]
}

export function getCachedData<T>(
  cache: Map<string, T>,
  basedir: string,
  originalBasedir: string,
) {
  const pkgData = cache.get(getFnpdCacheKey(basedir))
  if (pkgData) {
    traverseBetweenDirs(originalBasedir, basedir, (dir) => {
      cache.set(getFnpdCacheKey(dir), pkgData)
    })
    return pkgData
  }
}

export function setCacheData<T>(
  cache: Map<string, T>,
  data: T,
  basedir: string,
  originalBasedir: string,
) {
  cache.set(getFnpdCacheKey(basedir), data)
  traverseBetweenDirs(originalBasedir, basedir, (dir) => {
    cache.set(getFnpdCacheKey(dir), data)
  })
}

function getFnpdCacheKey(basedir: string) {
  return `fnpd_${basedir}`
}

/**
 * Traverse between `longerDir` (inclusive) and `shorterDir` (exclusive) and call `cb` for each dir.
 * @param longerDir Longer dir path, e.g. `/User/foo/bar/baz`
 * @param shorterDir Shorter dir path, e.g. `/User/foo`
 */
function traverseBetweenDirs(
  longerDir: string,
  shorterDir: string,
  cb: (dir: string) => void,
) {
  while (longerDir !== shorterDir) {
    cb(longerDir)
    longerDir = dirname(longerDir)
  }
}

export function withTrailingSlash(path: string): string {
  if (path[path.length - 1] !== '/')
    return `${path}/`

  return path
}

export function createImportMetaEnvProxy() {
  // packages/vitest/src/node/plugins/index.ts:146
  const booleanKeys = [
    'DEV',
    'PROD',
    'SSR',
  ]
  return new Proxy(process.env, {
    get(_, key) {
      if (typeof key !== 'string')
        return undefined
      if (booleanKeys.includes(key))
        return !!process.env[key]
      return process.env[key]
    },
    set(_, key, value) {
      if (typeof key !== 'string')
        return true

      if (booleanKeys.includes(key))
        process.env[key] = value ? '1' : ''
      else
        process.env[key] = value

      return true
    },
  })
}

const packageCache = new Map<string, { type?: 'module' | 'commonjs' }>()

export async function findNearestPackageData(basedir: string): Promise<{ type?: 'module' | 'commonjs' }> {
  const originalBasedir = basedir
  while (basedir) {
    const cached = getCachedData(packageCache, basedir, originalBasedir)
    if (cached)
      return cached

    const pkgPath = join(basedir, 'package.json')
    if ((await fsp.stat(pkgPath).catch(() => {}))?.isFile()) {
      const pkgData = JSON.parse(await fsp.readFile(pkgPath, 'utf8'))

      if (packageCache)
        setCacheData(packageCache, pkgData, basedir, originalBasedir)

      return pkgData
    }

    const nextBasedir = dirname(basedir)
    if (nextBasedir === basedir)
      break
    basedir = nextBasedir
  }

  return {}
}
