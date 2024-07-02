import type { Plugin } from 'vite'
import { join } from 'pathe'
import type { Vitest } from '../core'

export function VitestResolver(ctx: Vitest): Plugin {
  return {
    name: 'vitest:resolve-root',
    enforce: 'pre',
    async resolveId(id) {
      if (id === 'vitest' || id.startsWith('@vitest/')) {
        return this.resolve(id, join(ctx.config.root, 'index.html'), {
          skipSelf: true,
        })
      }
    },
  }
}
