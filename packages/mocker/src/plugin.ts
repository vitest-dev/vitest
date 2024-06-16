import { join } from 'node:path'
import type { Plugin } from 'vitest/config'
import { automockModule } from './automocker'
import { distDir } from './constants'

interface MockerOptions {
  spyModule?: string
}

export { automockModule }

export default function MockerPlugin(options: MockerOptions = {}): Plugin[] {
  let _spyModule = options.spyModule

  return [
    {
      name: 'vitest:mocker-resolve',
      enforce: 'pre',
      async resolveId(id, importer, opts) {
        // import { value } from './src/file.js' with { mock: 'auto' }
        if (opts.attributes.mock === 'auto') {
          const resolved = await this.resolve(id, importer, opts)
          if (resolved) {
            const attrs = { ...opts.attributes }
            delete attrs.mock
            return {
              ...resolved,
              id: injectQuery(resolved.id, 'mock=auto'),
              attributes: attrs,
            }
          }
        }
      },
    },
    {
      name: 'vitest:mocker-transform',
      enforce: 'post',
      async transform(code, id) {
        if (id.includes('mock=auto')) {
          if (!_spyModule) {
            _spyModule = slash(join('/@fs/', (await this.resolve('@vitest/spy', distDir))!.id))
          }

          const ms = automockModule(code, this.parse, _spyModule)
          return {
            code: ms.toString(),
            map: ms.generateMap({ hires: 'boundary', source: cleanUrl(id) }),
          }
        }
      },
    },
  ]
}

const postfixRE = /[?#].*$/
function cleanUrl(url: string): string {
  return url.replace(postfixRE, '')
}

const isWindows
  = typeof process !== 'undefined' && process.platform === 'win32'

const replacePercentageRE = /%/g
function injectQuery(url: string, queryToInject: string): string {
  // encode percents for consistent behavior with pathToFileURL
  // see #2614 for details
  const resolvedUrl = new URL(
    url.replace(replacePercentageRE, '%25'),
    'relative:///',
  )
  const { search, hash } = resolvedUrl
  let pathname = cleanUrl(url)
  pathname = isWindows ? slash(pathname) : pathname
  return `${pathname}?${queryToInject}${search ? `&${search.slice(1)}` : ''}${
    hash ?? ''
  }`
}

function slash(path: string) {
  return path.replace(/\\/g, '/')
}
