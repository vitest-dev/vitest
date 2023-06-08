import { fileURLToPath, pathToFileURL } from 'node:url'
import { builtinModules } from 'node:module'
import { existsSync } from 'node:fs'
import { resolve } from 'pathe'
import type { Arrayable, Nullable } from './types'

export const isWindows = process.platform === 'win32'

export function slash(str: string) {
  return str.replace(/\\/g, '/')
}

export const VALID_ID_PREFIX = '/@id/'

export function normalizeRequestId(id: string, base?: string): string {
  if (base && id.startsWith(base))
    id = `/${id.slice(base.length)}`

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

export function normalizeModuleId(id: string) {
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

export function toFilePath(id: string, root: string): string {
  let absolute = (() => {
    if (id.startsWith('/@fs/'))
      return id.slice(4)
    // check if /src/module.js -> <root>/src/module.js
    if (!id.startsWith(root) && id.startsWith('/')) {
      const resolved = resolve(root, id.slice(1))
      if (existsSync(cleanUrl(resolved)))
        return resolved
    }
    return id
  })()

  if (absolute.startsWith('//'))
    absolute = absolute.slice(1)

  // disambiguate the `<UNIT>:/` on windows: see nodejs/node#31710
  return (isWindows && absolute.startsWith('/'))
    ? slash(fileURLToPath(pathToFileURL(absolute.slice(1)).href))
    : absolute
}

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

const NODE_BUILTIN_NAMESPACE = 'node:'
export function isNodeBuiltin(id: string): boolean {
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
