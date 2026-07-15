import type { Plugin } from 'vite'
import type { PluginHarness } from '../config/pluginHarness'
import { join, resolve } from 'pathe'
import { distDir } from '../../paths'

export function VitestProjectResolver(harness: PluginHarness): Plugin {
  const plugin: Plugin = {
    name: 'vitest:resolve-root',
    enforce: 'pre',
    config: {
      order: 'post',
      handler() {
        return {
          base: '/',
        }
      },
    },
    async resolveId(id, _, { ssr }) {
      if (id === 'vitest' || id.startsWith('@vitest/') || id.startsWith('vitest/')) {
        // always redirect the request to the root vitest plugin since
        // it will be the one used to run Vitest
        const resolved = await harness.getVitest().vite.pluginContainer.resolveId(id, undefined, {
          skip: new Set([plugin]),
          ssr,
        })
        return resolved
      }
    },
  }
  return plugin
}

export function VitestCoreResolver(): Plugin {
  let root: string
  return {
    name: 'vitest:resolve-core',
    enforce: 'pre',
    config: {
      order: 'post',
      handler() {
        return {
          base: '/',
        }
      },
    },
    configResolved(config) {
      root = config.root
    },
    async resolveId(id) {
      if (id === 'vitest') {
        return resolve(distDir, 'index.js')
      }
      if (id.startsWith('@vitest/') || id.startsWith('vitest/')) {
        // ignore actual importer, we want it to be resolved relative to the root
        return this.resolve(id, join(root, 'index.html'), {
          skipSelf: true,
        })
      }
    },
  }
}
