import { searchForWorkspaceRoot, version as viteVersion } from 'vite'
import type { DepOptimizationOptions, ResolvedConfig, UserConfig as ViteConfig } from 'vite'
import { dirname } from 'pathe'
import type { DepsOptimizationOptions, InlineConfig } from '../../types'
import { VitestCache } from '../cache'
import { rootDir } from '../../paths'

export function resolveOptimizerConfig(_testOptions: DepsOptimizationOptions | undefined, viteOptions: DepOptimizationOptions | undefined, testConfig: InlineConfig) {
  const testOptions = _testOptions || {}
  const newConfig: { cacheDir?: string; optimizeDeps: DepOptimizationOptions } = {} as any
  const [major, minor, fix] = viteVersion.split('.').map(Number)
  const allowed = major >= 5 || (major === 4 && minor >= 4) || (major === 4 && minor === 3 && fix >= 2)
  if (!allowed && testOptions?.enabled === true)
    console.warn(`Vitest: "deps.optimizer" is only available in Vite >= 4.3.2, current Vite version: ${viteVersion}`)
  else
    // enable by default
    testOptions.enabled ??= true
  if (!allowed || testOptions?.enabled !== true) {
    newConfig.cacheDir = undefined
    newConfig.optimizeDeps = {
      // experimental in Vite >2.9.2, entries remains to help with older versions
      disabled: true,
      entries: [],
    }
  }
  else {
    const root = testConfig.root ?? process.cwd()
    const cacheDir = testConfig.cache !== false ? testConfig.cache?.dir : undefined
    const currentInclude = (testOptions.include || viteOptions?.include || [])
    const exclude = [
      'vitest',
      // Ideally, we shouldn't optimize react in test mode, otherwise we need to optimize _every_ dependency that uses react.
      'react',
      'vue',
      ...(testOptions.exclude || viteOptions?.exclude || []),
    ]
    const runtime = currentInclude.filter(n => n.endsWith('jsx-dev-runtime'))
    exclude.push(...runtime)

    const include = (testOptions.include || viteOptions?.include || []).filter((n: string) => !exclude.includes(n))

    newConfig.cacheDir = cacheDir ?? VitestCache.resolveCacheDir(root, cacheDir, testConfig.name)
    newConfig.optimizeDeps = {
      ...viteOptions,
      ...testOptions,
      noDiscovery: true,
      disabled: false,
      entries: [],
      exclude,
      include,
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

export function hijackVitePluginInject(viteConfig: ResolvedConfig) {
  // disable replacing `process.env.NODE_ENV` with static string
  const processEnvPlugin = viteConfig.plugins.find(p => p.name === 'vite:client-inject')
  if (processEnvPlugin) {
    const originalTransform = processEnvPlugin.transform as any
    processEnvPlugin.transform = function transform(code, id, options) {
      return originalTransform.call(this, code, id, { ...options, ssr: true })
    }
  }
}

export function resolveFsAllow(projectRoot: string, rootConfigFile: string | false | undefined) {
  if (!rootConfigFile)
    return [searchForWorkspaceRoot(projectRoot), rootDir]
  return [dirname(rootConfigFile), searchForWorkspaceRoot(projectRoot), rootDir]
}
