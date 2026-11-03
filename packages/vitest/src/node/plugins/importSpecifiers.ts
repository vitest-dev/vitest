import type { Plugin as VitePlugin } from 'vite'
import type { PluginHarness } from '../config/pluginHarness'
import * as esModuleLexer from 'es-module-lexer'

/**
 * Records the import specifiers before Vite replaces them with resolved urls,
 * so `fsModuleCache` can check that they still resolve to the same modules.
 */
export function ImportSpecifiersPlugin(harness: PluginHarness): VitePlugin {
  let browserEnabled = false
  return {
    name: 'vitest:import-specifiers',
    enforce: 'post',
    configResolved(config) {
      browserEnabled = !!config.test?.browser?.enabled
    },
    async transform(code) {
      // the browser does not load modules from the fs module cache
      if (browserEnabled && this.environment.config.consumer === 'client') {
        return
      }
      if (!harness.getVitest().cache._modules.enabled) {
        return
      }
      await esModuleLexer.init
      let imports: readonly esModuleLexer.ImportSpecifier[]
      try {
        imports = esModuleLexer.parse(code)[0]
      } catch {
        return { meta: { vitestImportSpecifiers: null } }
      }
      const specifiers = new Set<string>()
      for (const { n } of imports) {
        if (n != null) {
          specifiers.add(n)
        }
      }
      return { meta: { vitestImportSpecifiers: Array.from(specifiers) } }
    },
  }
}
