import type { Plugin } from 'vite'
import MagicString from 'magic-string'

const mockRegexp = /\b(?:vitest|vi)\s*.\s*(mock|unmock|importActual|importMock)\(["`'\s](.*[@\w_-]+)["`'\s]\);?/mg

export const MocksPlugin = (): Plugin => {
  return {
    name: 'vitest:mock-plugin',
    enforce: 'post',
    async transform(code, id) {
      let m: MagicString | undefined
      const matchAll = code.matchAll(mockRegexp)

      for (const match of matchAll) {
        const [line, method, modulePath] = match
        const filepath = await this.resolve(modulePath, id)
        if (filepath) {
          m ??= new MagicString(code)
          const start = match.index || 0
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
        }
      }

      if (m) {
        return {
          code: m.toString(),
          map: m.generateMap(),
        }
      }
    },
  }
}
