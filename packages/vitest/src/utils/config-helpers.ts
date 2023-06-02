import type { PluginOption } from 'vite'
import type { BenchmarkBuiltinReporters, BuiltinReporters } from '../node/reporters'

interface PotentialConfig {
  outputFile?: string | Partial<Record<string, string>>
}

export function getOutputFile(config: PotentialConfig | undefined, reporter: BuiltinReporters | BenchmarkBuiltinReporters | 'html') {
  if (!config?.outputFile)
    return

  if (typeof config.outputFile === 'string')
    return config.outputFile

  return config.outputFile[reporter]
}

async function isVitePlugin(plugin: PluginOption, name: string): Promise<boolean> {
  if (!plugin)
    return false
  if (Array.isArray(plugin))
    return hasVitePlugin(plugin, name)
  if (plugin instanceof Promise)
    return isVitePlugin(await plugin, name)
  if (typeof plugin === 'object')
    return plugin.name === name
  return false
}

export async function hasVitePlugin(plugins: PluginOption[], name: string): Promise<boolean> {
  for (const plugin of plugins) {
    if (await isVitePlugin(plugin, name))
      return true
  }

  return false
}
