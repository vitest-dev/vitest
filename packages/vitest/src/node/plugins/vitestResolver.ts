import type { Plugin } from 'vite'
import type { Vitest } from '../core'

export function VitestResolver(ctx: Vitest): Plugin {
  const plugin: Plugin = {
    name: 'vitest:resolve-root',
    enforce: 'pre',
    async resolveId(id, _, { ssr }) {
      if (id === 'vitest' || id.startsWith('@vitest/')) {
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
