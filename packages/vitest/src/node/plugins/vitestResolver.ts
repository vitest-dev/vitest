import type { Plugin } from 'vite'
import type { PluginHarness } from '../config/pluginHarness'
import { join, resolve } from 'pathe'
import { distDir } from '../../paths'
import { isBrowserExternal, isBuiltin } from '../../utils/modules'

export function VitestProjectResolver(harness: PluginHarness): Plugin {
  let browserEnabled = false
  const plugin: Plugin = {
    name: 'vitest:resolve-root',
    enforce: 'pre',
    config: {
      order: 'post',
      handler(config) {
        browserEnabled = !!config.test?.browser?.enabled
        return {
          base: '/',
        }
      },
    },
    async resolveId(id, _, { ssr }) {
      if (id === 'vitest' || id.startsWith('@vitest/') || id.startsWith('vitest/')) {
        // the browser pre-bundles vitest, and the optimizer's copy must win
        // so the tester and the test files share one module instance
        if (browserEnabled && this.environment?.name === 'client') {
          return
        }
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
  let browserEnabled = false
  return {
    name: 'vitest:resolve-core',
    enforce: 'pre',
    config: {
      order: 'post',
      handler(config) {
        browserEnabled = !!config.test?.browser?.enabled
        return {
          base: '/',
        }
      },
    },
    configResolved(config) {
      root = config.root
    },
    async resolveId(id) {
      // the browser pre-bundles vitest, and the optimizer's copy must win
      // so the tester and the test files share one module instance
      if (browserEnabled && this.environment?.name === 'client') {
        return
      }
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

export function VitestBuiltinResolver(): Plugin {
  return {
    name: 'vitest:resolve-builtin',
    enforce: 'pre',
    applyToEnvironment(environment) {
      return (
        environment.config.consumer === 'client' && environment.config.dev.moduleRunnerTransform
      )
    },
    async resolveId(id, importer, options) {
      if (!isBuiltin(id)) {
        return
      }
      const resolved = await this.resolve(id, importer, { ...options, skipSelf: true })
      // Vite replaces builtins with a browser shim, but the module runner can import them
      if (resolved && isBrowserExternal(resolved.id)) {
        return { id, external: true }
      }
      return resolved
    },
  }
}
