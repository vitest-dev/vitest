import { builtinModules } from 'node:module'
import { version as viteVersion } from 'vite'
import type { DepOptimizationOptions, UserConfig as ViteConfig } from 'vite'
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

export function deleteDefineConfig(viteConfig: ViteConfig) {
  const defines: Record<string, any> = {}
  if (viteConfig.define) {
    delete viteConfig.define['import.meta.vitest']
    delete viteConfig.define['process.env']
    delete viteConfig.define.process
    delete viteConfig.define.global
  }
  for (const key in viteConfig.define) {
    const val = viteConfig.define[key]
    let replacement: any
    try {
      replacement = typeof val === 'string' ? JSON.parse(val) : val
    }
    catch {
      // probably means it contains reference to some variable,
      // like this: "__VAR__": "process.env.VAR"
      continue
    }
    if (key.startsWith('import.meta.env.')) {
      const envKey = key.slice('import.meta.env.'.length)
      process.env[envKey] = replacement
      delete viteConfig.define[key]
    }
    else if (key.startsWith('process.env.')) {
      const envKey = key.slice('process.env.'.length)
      process.env[envKey] = replacement
      delete viteConfig.define[key]
    }
    else if (!key.includes('.')) {
      defines[key] = replacement
      delete viteConfig.define[key]
    }
  }
  return defines
}
