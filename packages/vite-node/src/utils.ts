import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, resolve } from 'pathe'
import type { TransformResult } from 'vite'

export const isWindows = process.platform === 'win32'

export function slash(str: string) {
  return str.replace(/\\/g, '/')
}

export function normalizeId(id: string, base?: string): string {
  if (base && id.startsWith(base))
    id = `/${id.slice(base.length)}`

  return id
    .replace(/^\/@id\/__x00__/, '\0') // virtual modules start with `\0`
    .replace(/^\/@id\//, '')
    .replace(/^__vite-browser-external:/, '')
    .replace(/^(node|file):/, '')
    .replace(/^\/+/, '/') // remove duplicate leading slashes
    .replace(/[?&]v=\w+/, '?') // remove ?v= query
    .replace(/\?import/, '') // remove ?import query
    .replace(/\?$/, '') // remove end query mark
}

export function isPrimitive(v: any) {
  return v !== Object(v)
}

export function toFilePath(id: string, root: string): string {
  let absolute = slash(id).startsWith('/@fs/')
    ? id.slice(4)
    : id.startsWith(dirname(root)) && dirname(root) !== '/'
      ? id
      : id.startsWith('/')
        ? slash(resolve(root, id.slice(1)))
        : id

  if (absolute.startsWith('//'))
    absolute = absolute.slice(1)

  // disambiguate the `<UNIT>:/` on windows: see nodejs/node#31710
  return isWindows && absolute.startsWith('/')
    ? fileURLToPath(pathToFileURL(absolute.slice(1)).href)
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
