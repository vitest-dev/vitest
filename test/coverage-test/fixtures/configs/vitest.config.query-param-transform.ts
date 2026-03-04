import { defineConfig, mergeConfig } from 'vitest/config'
import MagicString from 'magic-string'
import remapping from '@jridgewell/remapping'
import type { Plugin } from 'vite'

import base from './vitest.config'

export default mergeConfig(
  base,
  defineConfig({
    plugins: [QueryParamTransforms()],
    test: {}
  })
)

/**
 * Attempts to do Vue-like query param based transforms
 */
function QueryParamTransforms(): Plugin {
  return {
    name: 'vitest-custom-query-param-based-transform',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('src/query-param-transformed')) {
        const transformed = new MagicString(code)
        const query = id.split("?query=").pop()

        if(query === "first") {
          transformed.remove(
            code.indexOf("/* QUERY_PARAM FIRST START */"),
            code.indexOf("/* QUERY_PARAM FIRST END */") + "/* QUERY_PARAM FIRST END */".length,
          )
        } else if(query === "second") {
          transformed.remove(
            code.indexOf("/* QUERY_PARAM SECOND START */"),
            code.indexOf("/* QUERY_PARAM SECOND END */") + "/* QUERY_PARAM SECOND END */".length,
          )
        } else {
          transformed.remove(
            code.indexOf("/* QUERY_PARAM FIRST START */"),
            code.length,
          )
        }

        const map = remapping(
          [transformed.generateMap({ hires: true }), this.getCombinedSourcemap() as any],
          () => null,
        ) as any

        return { code: transformed.toString(), map }
      }
    },
  }
}