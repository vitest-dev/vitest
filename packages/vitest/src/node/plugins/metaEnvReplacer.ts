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
        const startIndex = env.index!
        const endIndex = startIndex + env[0].length

        // Skip when `import.meta.env` itself is the target of an assignment
        // (e.g. `import.meta.env = {}` or `import.meta.env ||= {}`). Wrapping it
        // in `Object.assign(...)` would produce an invalid assignment target and
        // a parse error. Property assignments like `import.meta.env.FOO = 1` are
        // not affected because `import.meta.env` is followed by `.FOO` there.
        if (isAssignmentTarget(cleanCode, endIndex)) {
          continue
        }

        s ||= new MagicString(code)
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

// Matches an assignment operator (`=`, `+=`, `||=`, `??=`, etc.) right after the
// given index, while ignoring comparisons (`==`, `===`) and arrow functions (`=>`).
function isAssignmentTarget(code: string, index: number): boolean {
  return /^\s*(?:\?\?=|\|\|=|&&=|\*\*=|>>>=|<<=|>>=|[-+*/%&|^]=|=(?![=>]))/.test(
    code.slice(index),
  )
}
