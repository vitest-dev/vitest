import type { Plugin as VitePlugin } from 'vite'
import type { PluginHarness } from '../config/pluginHarness'

export function CoverageTransform(harness: PluginHarness): VitePlugin {
  return {
    name: 'vitest:coverage-transform',
    enforce: 'post',
    transform(srcCode, id) {
      return harness.getVitest().coverageProvider?.onFileTransform?.(
        srcCode,
        id,
        this,
      )
    },
  }
}
