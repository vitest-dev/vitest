import { defineConfig, mergeConfig } from 'vitest/config'
import MagicString from 'magic-string'
import remapping from '@ampproject/remapping'
import type { Plugin } from 'vite'

import base from './vitest.config'

export default mergeConfig(
  base,
  defineConfig({
    plugins: [MultiTransformPlugin()],
    test: {}
  })
)

/*
 * Transforms `multi-environment.ts` differently based on test environment (JSDOM/Node)
 * so that there are multiple different source maps for a single file.
 * This causes a case where coverage report is incorrect if sourcemaps are not picked based on transform mode.
 */
function MultiTransformPlugin(): Plugin {
  return {
    name: 'vitest-custom-multi-transform',
    enforce: 'pre',
    transform(code, id, options) {
      if (id.includes('src/multi-environment')) {
        const ssr = options?.ssr || false
        const transformMode = `transformMode is ${ssr ? 'ssr' : 'csr'}`
        const padding = '\n*****'.repeat(ssr ? 0 : 15)

        const transformed = new MagicString(code)
        transformed.replace('\'default-padding\'', `\`${transformMode} ${padding}\``)

        const map = remapping(
          [transformed.generateMap({ hires: true }), this.getCombinedSourcemap() as any],
          () => null,
        ) as any

        return { code: transformed.toString(), map }
      }
    },
  }
}