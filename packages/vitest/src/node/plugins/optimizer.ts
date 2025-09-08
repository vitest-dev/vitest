import type { Plugin } from 'vite'
import { resolve } from 'pathe'
import { VitestCache } from '../cache'

export function VitestOptimizer(): Plugin {
  return {
    name: 'vitest:normalize-optimizer',
    config: {
      order: 'post',
      handler(viteConfig) {
        const testConfig = viteConfig.test || {}

        const root = resolve(viteConfig.root || process.cwd())
        const name = viteConfig.test?.name
        const label = typeof name === 'string' ? name : (name?.label || '')

        viteConfig.cacheDir = VitestCache.resolveCacheDir(
          resolve(root || process.cwd()),
          testConfig.cache != null && testConfig.cache !== false
            ? testConfig.cache.dir
            : viteConfig.cacheDir,
          label,
        )
      },
    },
  }
}
