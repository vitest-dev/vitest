import type {
  DepOptimizationOptions,
  UserConfig as ViteConfig,
} from 'vite'
import type { DepsOptimizationOptions } from '../types/config'
import { dirname } from 'pathe'
import { searchForWorkspaceRoot, version as viteVersion } from 'vite'
import * as vite from 'vite'
import { rootDir } from '../../paths'

export function resolveOptimizerConfig(
  _testOptions: DepsOptimizationOptions | undefined,
  viteOptions: DepOptimizationOptions | undefined,
): DepOptimizationOptions {
  const testOptions = _testOptions || {}
  let optimizeDeps: DepOptimizationOptions
  if (testOptions.enabled !== true) {
    testOptions.enabled ??= false

    optimizeDeps = {
      // experimental in Vite >2.9.2, entries remains to help with older versions
      disabled: true,
      entries: [],
    }
  }
  else {
    const currentInclude = testOptions.include || viteOptions?.include || []
    const exclude = [
      'vitest',
      // Ideally, we shouldn't optimize react in test mode, otherwise we need to optimize _every_ dependency that uses react.
      'react',
      'vue',
      ...(testOptions.exclude || viteOptions?.exclude || []),
    ]
    const runtime = currentInclude.filter(
      n => n.endsWith('jsx-dev-runtime') || n.endsWith('jsx-runtime'),
    )
    exclude.push(...runtime)

    const include = (testOptions.include || viteOptions?.include || []).filter(
      (n: string) => !exclude.includes(n),
    )

    optimizeDeps = {
      ...viteOptions,
      ...testOptions,
      noDiscovery: true,
      disabled: false,
      entries: [],
      exclude,
      include,
    }
  }

  // `optimizeDeps.disabled` is deprecated since v5.1.0-beta.1
  // https://github.com/vitejs/vite/pull/15184
  if (optimizeDeps.disabled) {
    optimizeDeps.noDiscovery = true
    optimizeDeps.include = []
  }
  delete optimizeDeps.disabled

  return optimizeDeps
}

export function deleteDefineConfig(viteConfig: ViteConfig): Record<string, any> {
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

export function resolveFsAllow(
  projectRoot: string,
  rootConfigFile: string | false | undefined,
): string[] {
  if (!rootConfigFile) {
    return [searchForWorkspaceRoot(projectRoot), rootDir]
  }
  return [
    dirname(rootConfigFile),
    searchForWorkspaceRoot(projectRoot),
    rootDir,
  ]
}

export function getDefaultResolveOptions(): vite.ResolveOptions {
  return {
    // by default Vite resolves `module` field, which is not always a native ESM module
    // setting this option can bypass that and fallback to cjs version
    mainFields: [],
    // same for `module` condition and Vite 5 doesn't even allow excluding it,
    // but now it's possible since Vite 6.
    conditions: getDefaultServerConditions(),
  }
}

function getDefaultServerConditions(): string[] {
  const viteMajor = Number(viteVersion.split('.')[0])
  if (viteMajor >= 6) {
    const conditions: string[] = (vite as any).defaultServerConditions
    return conditions.filter(c => c !== 'module')
  }
  return ['node']
}
