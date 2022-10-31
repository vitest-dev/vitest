import { fileURLToPath, pathToFileURL } from 'url'
import { existsSync } from 'fs'
import { relative, resolve } from 'pathe'
import type { TransformResult } from 'vite'
import { isNodeBuiltin } from 'mlly'
import type { Arrayable, Nullable } from './types'

export const isWindows = process.platform === 'win32'

export function slash(str: string) {
  return str.replace(/\\/g, '/')
}

export function mergeSlashes(str: string) {
  return str.replace(/\/\//g, '/')
}

export function normalizeRequestId(id: string, base?: string): string {
  if (base && id.startsWith(base))
    id = `/${id.slice(base.length)}`

  return id
    .replace(/^\/@id\/__x00__/, '\0') // virtual modules start with `\0`
    .replace(/^\/@id\//, '')
    .replace(/^__vite-browser-external:/, '')
    .replace(/^(node|file):/, '')
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

export function normalizeModuleId(id: string) {
  return id
    .replace(/\\/g, '/')
    .replace(/^\/@fs\//, '/')
    .replace(/^file:\//, '/')
    .replace(/^\/+/, '/')
}

export function isPrimitive(v: any) {
  return v !== Object(v)
}

export function pathFromRoot(root: string, filename: string) {
  if (isNodeBuiltin(filename))
    return filename

  // don't replace with "/" on windows, "/C:/foo" is not a valid path
  filename = filename.replace(/^\/@fs\//, isWindows ? '' : '/')

  if (!filename.startsWith(root))
    return filename

  const relativePath = relative(root, filename)

  const segments = relativePath.split('/')
  const startIndex = segments.findIndex(segment => segment !== '..' && segment !== '.')

  return `/${segments.slice(startIndex).join('/')}`
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

let SOURCEMAPPING_URL = 'sourceMa'
SOURCEMAPPING_URL += 'ppingURL'

export async function withInlineSourcemap(result: TransformResult) {
  const { code, map } = result

  if (code.includes(`${SOURCEMAPPING_URL}=`))
    return result
  if (map)
    result.code = `${code}\n\n//# ${SOURCEMAPPING_URL}=data:application/json;charset=utf-8;base64,${Buffer.from(JSON.stringify(map), 'utf-8').toString('base64')}\n`

  return result
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
