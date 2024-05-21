import type { WorkspaceProject } from '../node/workspace'
import type { BrowserProviderModule, ResolvedBrowserOptions } from '../types/browser'

const builtinProviders = ['webdriverio', 'playwright', 'none']

export async function getBrowserProvider(options: ResolvedBrowserOptions, project: WorkspaceProject): Promise<BrowserProviderModule> {
  if (options.provider == null || builtinProviders.includes(options.provider)) {
    const root = project.config.root
    await project.ctx.packageInstaller.ensureInstalled('@vitest/browser', root)
    const importer = await project.getImporter()
    const providers = await importer.import('@vitest/browser/providers') as {
      webdriverio: BrowserProviderModule
      playwright: BrowserProviderModule
      none: BrowserProviderModule
    }
    const provider = (options.provider || 'webdriverio') as 'webdriverio' | 'playwright' | 'none'
    return providers[provider]
  }

  let customProviderModule

  try {
    const importer = await project.getImporter()
    customProviderModule = await importer.import(options.provider) as { default: BrowserProviderModule }
  }
  catch (error) {
    throw new Error(`Failed to load custom BrowserProvider from ${options.provider}`, { cause: error })
  }

  if (customProviderModule.default == null)
    throw new Error(`Custom BrowserProvider loaded from ${options.provider} was not the default export`)

  return customProviderModule.default
}
