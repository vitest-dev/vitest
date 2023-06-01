import { builtinModules } from 'node:module'
import { version as viteVersion } from 'vite'
import type { DepOptimizationOptions } from 'vite'
import type { DepsOptimizationOptions, InlineConfig } from '../../types'

export function resolveOptimizerConfig(testOptionc: DepsOptimizationOptions | undefined, viteOptions: DepOptimizationOptions | undefined, testConfig: InlineConfig) {
  const newConfig: { cacheDir?: string; optimizeDeps: DepOptimizationOptions } = {} as any
  const [major, minor] = viteVersion.split('.').map(Number)
  const allowed = major >= 5 || (major === 4 && minor >= 3)
  if (!allowed && testOptionc?.enabled === true)
    console.warn(`Vitest: "deps.optimizer" is only available in Vite >= 4.3.0, current Vite version: ${viteVersion}`)
  if (!allowed || testOptionc?.enabled !== true) {
    newConfig.cacheDir = undefined
    newConfig.optimizeDeps = {
      // experimental in Vite >2.9.2, entries remains to help with older versions
      disabled: true,
      entries: [],
    }
  }
  else {
    const cacheDir = testConfig.cache !== false ? testConfig.cache?.dir : null
    newConfig.cacheDir = cacheDir ?? 'node_modules/.vitest'
    newConfig.optimizeDeps = {
      ...viteOptions,
      ...testOptionc,
      noDiscovery: true,
      disabled: false,
      entries: [],
      exclude: ['vitest', ...builtinModules, ...(testOptionc.exclude || viteOptions?.exclude || [])],
      include: (testOptionc.include || viteOptions?.include || []).filter((n: string) => n !== 'vitest'),
    }
  }
  return newConfig
}
