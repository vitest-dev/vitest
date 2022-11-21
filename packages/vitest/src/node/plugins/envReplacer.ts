import MagicString from 'magic-string'
import type { Plugin } from 'vite'
import { stripLiteral } from 'strip-literal'

// so people can reassign envs at runtime
// import.meta.env.VITE_NAME = 'app' -> process.env.VITE_NAME = 'app'
export const EnvReplacerPlugin = (): Plugin => {
  return {
    name: 'vitest:env-replacer',
    enforce: 'pre',
    transform(code, id) {
      if (!/\bimport\.meta\.env\b/g.test(code))
        return null

      let s: MagicString | null = null
      const envs = stripLiteral(code).matchAll(/\bimport\.meta\.env\b/g)

      for (const env of envs) {
        s ||= new MagicString(code)

        const startIndex = env.index!
        const endIndex = startIndex + env[0].length

        s.overwrite(startIndex, endIndex, 'process.env')
      }

      if (s) {
        return {
          code: s.toString(),
          map: s.generateMap({ hires: true, source: id }),
        }
      }
    },
  }
}
