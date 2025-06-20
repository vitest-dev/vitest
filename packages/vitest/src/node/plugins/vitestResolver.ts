import type { Plugin } from 'vite'
import type { Vitest } from '../core'
import { join, resolve } from 'pathe'
import { distDir } from '../../paths'

export function VitestProjectResolver(ctx: Vitest): Plugin {
  const plugin: Plugin = {
    name: 'vitest:resolve-root',
    enforce: 'pre',
    async resolveId(id, _, { ssr }) {
      if (id === 'vitest' || id.startsWith('@vitest/') || id.startsWith('vitest/')) {
        // always redirect the request to the root vitest plugin since
        // it will be the one used to run Vitest
        const resolved = await ctx.server.pluginContainer.resolveId(id, undefined, {
          skip: new Set([plugin]),
          ssr,
        })
        return resolved
      }
    },
  }
  return plugin
}

export function VitestCoreResolver(ctx: Vitest): Plugin {
  return {
    name: 'vitest:resolve-core',
    enforce: 'pre',
    async resolveId(id) {
      if (id === 'vitest') {
        return resolve(distDir, 'index.js')
      }
      if (id.startsWith('@vitest/') || id.startsWith('vitest/')) {
        // ignore actual importer, we want it to be resolved relative to the root
        return this.resolve(id, join(ctx.config.root, 'index.html'), {
          skipSelf: true,
        })
      }
    },
  }
}
