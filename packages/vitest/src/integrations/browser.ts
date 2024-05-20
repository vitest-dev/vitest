import type { WorkspaceProject } from '../node/workspace'
import type { BrowserProviderModule, ResolvedBrowserOptions } from '../types/browser'

const builtinProviders = ['webdriverio', 'playwright', 'none']

export async function getBrowserProvider(options: ResolvedBrowserOptions, project: WorkspaceProject): Promise<BrowserProviderModule> {
  if (options.provider == null || builtinProviders.includes(options.provider)) {
    const root = project.config.root
    await project.ctx.packageInstaller.ensureInstalled('@vitest/browser', root)
    const providersPath = await project.ctx.importer.resolveId(
      '@vitest/browser/providers',
      root,
    )
    if (!providersPath)
      throw new Error(`Cannot find "@vitest/browser/providers" installed in ${root}`)
    const providers = await project.ctx.importer.import(providersPath.id) as {
      webdriverio: BrowserProviderModule
      playwright: BrowserProviderModule
      none: BrowserProviderModule
    }
    const provider = (options.provider || 'webdriverio') as 'webdriverio' | 'playwright' | 'none'
    return providers[provider]
  }

  let customProviderModule

  try {
    const root = project.config.root
    const providersPath = await project.ctx.importer.resolveId(options.provider, root)
    if (!providersPath)
      throw new Error(`Cannot find "${options.provider}" installed in ${root}`)

    customProviderModule = await project.ctx.importer.import(providersPath.id) as { default: BrowserProviderModule }
  }
  catch (error) {
    throw new Error(`Failed to load custom BrowserProvider from ${options.provider}`, { cause: error })
  }

  if (customProviderModule.default == null)
    throw new Error(`Custom BrowserProvider loaded from ${options.provider} was not the default export`)

  return customProviderModule.default
}
