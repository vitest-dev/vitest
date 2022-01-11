import type { Plugin } from 'vite'
import MagicString from 'magic-string'

const mockRegexp = /\b((?:vitest|vi)\s*.\s*mock\(["`'\s](.*[@\w_-]+)["`'\s])[),]{1}/
const pathRegexp = /\b(?:vitest|vi)\s*.\s*(unmock|importActual|importMock)\(["`'\s](.*[@\w_-]+)["`'\s]\);?/mg
const vitestRegexp = /import {[^}]*}.*(?=["'`]vitest["`']).*/gm

const isComment = (line: string) => {
  const commentStarts = ['//', '/*', '*']

  line = line.trim()

  return commentStarts.some(cmt => line.startsWith(cmt))
}

interface MockCodeblock {
  code: string
  declaraton: string
  path: string
}

const parseMocks = (code: string) => {
  const splitted = code.split('\n')

  const mockCalls: Record<string, MockCodeblock> = {}
  let mockCall = 0
  let lineIndex = -1

  while (lineIndex < splitted.length) {
    lineIndex++

    const line = splitted[lineIndex]

    if (line === undefined) break

    const mock = mockCalls[mockCall] || {
      code: '',
      declaraton: '',
      path: '',
    }

    if (!mock.code) {
      const started = mockRegexp.exec(line)

      if (!started || isComment(line)) continue

      mock.code += `${line}\n`
      mock.declaraton = started[1]
      mock.path = started[2]

      mockCalls[mockCall] = mock

      // end at the same line
      // we parse code after vite, so it contains semicolons
      if (line.includes(');')) {
        mockCall++
        continue
      }

      continue
    }

    mock.code += `${line}\n`

    mockCalls[mockCall] = mock

    const startNumber = (mock.code.match(/{/g) || []).length
    const endNumber = (mock.code.match(/}/g) || []).length

    // we parse code after vite, so it contains semicolons
    if (line.includes(');')) {
      /**
       * Check if number of {} is equal or this:
       * vi.mock('path', () =>
       *  loadStore()
       * );
       */
      if (startNumber === endNumber || (startNumber === 0 && endNumber === 0))
        mockCall++
    }
  }

  return Object.values(mockCalls)
}

const getMethodCall = (method: string, actualPath: string, importPath: string) => {
  let nodeModule = 'null'
  if (actualPath.includes('/node_modules/'))
    nodeModule = `"${importPath}"`

  return `__vitest__${method}__("${actualPath}", ${nodeModule}`
}

export const MocksPlugin = (): Plugin => {
  return {
    name: 'vitest:mock-plugin',
    enforce: 'post',
    async transform(code, id) {
      let m: MagicString | undefined
      const matchAll = code.matchAll(pathRegexp)

      for (const match of matchAll) {
        const [line, method, modulePath] = match
        const filepath = await this.resolve(modulePath, id)
        m ??= new MagicString(code)
        const start = match.index || 0
        const end = start + line.length

        const overwrite = `${getMethodCall(method, filepath?.id || modulePath, modulePath)});`

        m.overwrite(start, end, overwrite)
      }

      if (mockRegexp.exec(code)) {
        // we need to parse parsed string because factory may contain importActual
        const mocks = parseMocks(m?.toString() || code)

        for (const mock of mocks) {
          const filepath = await this.resolve(mock.path, id)

          m ??= new MagicString(code)

          const overwrite = getMethodCall('mock', filepath?.id || mock.path, mock.path)

          m.prepend(mock.code.replace(mock.declaraton, overwrite))
        }
      }

      if (m) {
        // hoist vitest imports in case it was used inside vi.mock factory #425
        const vitestImports = code.matchAll(vitestRegexp)
        for (const match of vitestImports) {
          const indexStart = match.index!
          const indexEnd = match[0].length + indexStart
          m.remove(indexStart, indexEnd)
          m.prepend(`${match[0]}\n`)
        }
        return {
          code: m.toString(),
          map: m.generateMap({ hires: true }),
        }
      }
    },
  }
}
