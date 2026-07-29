import type { Plugin } from 'vite'
import { cleanUrl } from '@vitest/utils/helpers'
import MagicString from 'magic-string'
import { stripLiteral } from 'strip-literal'

// so people can reassign envs at runtime
// import.meta.env.VITE_NAME = 'app' -> process.env.VITE_NAME = 'app'
export function MetaEnvReplacerPlugin(): Plugin {
  return {
    name: 'vitest:meta-env-replacer',
    enforce: 'pre',
    transform(code, id) {
      if (!/\bimport\.meta\.env\b/.test(code)) {
        return null
      }

      let s: MagicString | null = null
      const cleanCode = stripLiteral(code)
      const envs = cleanCode.matchAll(/\bimport\.meta\.env\b/g)

      for (const env of envs) {
        s ||= new MagicString(code)

        const startIndex = env.index!
        const endIndex = startIndex + env[0].length

        s.overwrite(
          startIndex,
          endIndex,
          `Object.assign(/* istanbul ignore next */ globalThis.__vitest_worker__?.metaEnv ?? import.meta.env)`,
        )
      }

      if (s) {
        return {
          code: s.toString(),
          map: s.generateMap({
            hires: 'boundary',

            // Remove possible query parameters, e.g. vue's "?vue&type=script&src=true&lang.ts"
            source: cleanUrl(id),
          }),
        }
      }
    },
  }
}
