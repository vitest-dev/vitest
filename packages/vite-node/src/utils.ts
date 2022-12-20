import { fileURLToPath, pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
import { resolve } from 'pathe'
import type { Arrayable, Nullable } from './types'

export const isWindows = process.platform === 'win32'

export function slash(str: string) {
  return str.replace(/\\/g, '/')
}

export function mergeSlashes(str: string) {
  return str.replace(/\/\//g, '/')
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

export const cleanUrl = (url: string): string =>
  url.replace(hashRE, '').replace(queryRE, '')

export const isInternalRequest = (id: string): boolean => {
  return id.startsWith('/@vite/')
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
    if (!id.startsWith(root) && id.startsWith('/')) {
      const resolved = resolve(root, id.slice(1))
      // The resolved path can have query values. Remove them before checking
      // the file path.
      if (existsSync(resolved.replace(/\?.*$/, '')))
        return resolved
    }
    return id
  })()

  if (absolute.startsWith('//'))
    absolute = absolute.slice(1)

  // disambiguate the `<UNIT>:/` on windows: see nodejs/node#31710
  return isWindows && absolute.startsWith('/')
    ? slash(fileURLToPath(pathToFileURL(absolute.slice(1)).href))
    : absolute
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
