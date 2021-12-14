import { basename, dirname, join } from 'path'
import { readFile } from 'fs/promises'
import MagicString from 'magic-string'
import type { Plugin } from 'vite'

export const SUITE_PATH_DELIMITER = '_%_'

const getSuiteById = (id: string) => {
  const suite = /\?suite=(.*)/.exec(id)
  if (!suite) return null
  return suite[1]
}

const prepareSuitePath = (suite: string) => {
  return suite.replace(new RegExp(SUITE_PATH_DELIMITER, 'g'), '/')
}

// TODO right now requires `threads: true`
export function MocksPlugin(): Plugin {
  const patternImport = /import(?:["'\s]*([\w*${}\n\r\t, ]+)from\s*)?["'\s]["'\s](.*[@\w_-]+)["'\s]$/mg
  // TODO
  // const patternDImport = /import\((?:["'\s]*([\w*{}\n\r\t, ]+)\s*)?["'\s](.*([@\w_-]+))["'\s]\)$/mg
  const mockRegexp = /vitest.mock\(["'\s](.*[@\w_-]+)["'\s]\)/mg

  let suitesMocksCache: Record<string, Set<string>> = {}

  const shouldUseMock = async(suite: string, path: string | null) => {
    if (!path) return false

    return suitesMocksCache[suite]?.has(path)
  }

  return {
    name: 'vitest:mock',
    enforce: 'pre',
    async handleHotUpdate() {
      suitesMocksCache = {}
    },
    async resolveId(id, importer) {
      if (id.startsWith('/@fs/') || !importer) return

      const resolvePath = async(id: string, importer: string) => {
        const [baseId] = id.split('?')
        const path = await this.resolve(baseId, importer, { skipSelf: true })
        if (!path) return null
        return path.id
      }

      const updateSuiteMocks = async(suite: string) => {
        const suitePath = prepareSuitePath(suite)
        const content = await readFile(suitePath, 'utf-8')
        let match: RegExpExecArray | null

        suitesMocksCache[suite] ??= new Set()

        // eslint-disable-next-line no-cond-assign
        while (match = mockRegexp.exec(content)) {
          const mockPath = await resolvePath(match[1], suitePath)
          if (!mockPath) continue
          suitesMocksCache[suite].add(mockPath)
        }
      }

      const suite = getSuiteById(id)

      if (!suite) return

      if (!suitesMocksCache[suite])
        await updateSuiteMocks(suite)

      const needMock = await shouldUseMock(suite, await resolvePath(id, importer))

      if (needMock) {
        const dir = dirname(id)
        const [baseId] = basename(id).split('?')
        const mockFile = join(dir, '__mocks__', baseId)

        const fullPath = await resolvePath(mockFile, importer)

        if (fullPath)
          return fullPath
      }

      // vite doesnt understand vitest?suite=...
      if (suite && !id.startsWith('/') && !id.startsWith('.'))
        return this.resolve(id.replace(`?suite=${suite}`, ''), importer, { skipSelf: true })
    },
    transform(code, id) {
      const suite = getSuiteById(id)
      if (!suite) return

      const m = new MagicString(code)
      let match: RegExpExecArray | null
      let replaced = false

      const appendImport = (match: RegExpExecArray) => {
        replaced = true
        const end = match.index + match[0].length - 1
        m.appendRight(end, `?suite=${suite}`)
      }

      // eslint-disable-next-line no-cond-assign
      while (match = patternImport.exec(code))
        appendImport(match)

      if (!replaced) return undefined

      return {
        code: m.toString(),
      }
    },
  }
}
