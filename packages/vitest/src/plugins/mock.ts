import type { Plugin } from 'vite'
import MagicString from 'magic-string'

const mockRegexp = /(?:vitest|vi).(mock|unmock|requireActual|requireMock)\(["`'\s](.*[@\w_-]+)["`'\s]\);?/mg

export const MocksPlugin = (): Plugin => {
  return {
    name: 'vitest:mock-plugin',
    enforce: 'post',
    async transform(code, id) {
      let match: RegExpExecArray | null

      let m: MagicString | undefined

      // eslint-disable-next-line no-cond-assign
      while (match = mockRegexp.exec(code)) {
        const line = match[0]
        const method = match[1]
        const modulePath = match[2]
        const filepath = await this.resolve(modulePath, id)
        if (filepath) {
          m ??= new MagicString(code)
          const start = match.index
          const end = start + line.length

          let nodeModule = 'null'
          if (filepath.id.includes('/node_modules/'))
            nodeModule = `"${modulePath}"`

          const overwrite = `__vitest__${method}__("${filepath.id}", ${nodeModule});`

          if (method === 'mock') {
            m.prepend(`${overwrite}\n\n`)
            m.remove(start, end)
          }
          else {
            m.overwrite(start, end, overwrite)
          }

          code = m.toString()
        }
      }

      if (m) {
        return {
          code,
          map: m.generateMap(),
        }
      }
    },
  }
}
