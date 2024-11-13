import type { Plugin } from 'vite'
import { resolveOptimizerConfig } from './utils'

export function VitestOptimizer(): Plugin {
  return {
    name: 'vitest:normalize-optimizer',
    config: {
      order: 'post',
      handler(viteConfig) {
        const testConfig = viteConfig.test || {}
        const webOptimizer = resolveOptimizerConfig(
          testConfig.deps?.optimizer?.web,
          viteConfig.optimizeDeps,
        )
        const ssrOptimizer = resolveOptimizerConfig(
          testConfig.deps?.optimizer?.ssr,
          viteConfig.ssr?.optimizeDeps,
        )

        viteConfig.optimizeDeps = webOptimizer.optimizeDeps
        viteConfig.ssr ??= {}
        viteConfig.ssr.optimizeDeps = ssrOptimizer.optimizeDeps
      },
    },
  }
}
