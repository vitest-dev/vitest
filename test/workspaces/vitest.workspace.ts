import { defineWorkspace } from 'vitest/config'
import MagicString from 'magic-string'
import remapping from '@ampproject/remapping'
import type { Plugin } from 'vite'

export default defineWorkspace([
  'space_2',
  './space_*/*.config.ts',
  {
    test: {
      name: 'happy-dom',
      root: './space_shared',
      environment: 'happy-dom',
      setupFiles: ['./setup.jsdom.ts'],
    },
  },
  {
    test: {
      name: 'node',
      root: './space_shared',
      environment: 'node',
      setupFiles: ['./setup.node.ts'],
    },
  },

  // These two projects run on same environment but still transform
  // a single file differently due to Vite plugins
  {
    plugins: [customPlugin(0)],
    test: {
      name: 'Project with custom plugin #1',
      environment: 'node',
      include: ['./space-multi-transform/test/project-1.test.ts'],
    },
  },
  {
    plugins: [customPlugin(15)],
    test: {
      name: 'Project with custom plugin #2',
      environment: 'node',
      include: ['./space-multi-transform/test/project-2.test.ts'],
    },
  },
])

function customPlugin(offset: number): Plugin {
  return {
    name: 'vitest-custom-multi-transform',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('space-multi-transform/src/multi-transform.ts')) {
        const padding = '\n*****'.repeat(offset)

        const transformed = new MagicString(code)
        transformed.replace('\'default-padding\'', `\`${padding}\``)

        const map = remapping(
          [transformed.generateMap({ hires: true }), this.getCombinedSourcemap() as any],
          () => null,
        ) as any

        return { code: transformed.toString(), map }
      }
    },
  }
}
