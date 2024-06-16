import type { WorkspaceProject } from '../node/workspace'
import type {
  BrowserProviderModule,
  ResolvedBrowserOptions,
} from '../types/browser'

const builtinProviders = ['webdriverio', 'playwright', 'preview']

export async function getBrowserProvider(
  options: ResolvedBrowserOptions,
  project: WorkspaceProject,
): Promise<BrowserProviderModule> {
  if (options.provider == null || builtinProviders.includes(options.provider)) {
    await project.ctx.packageInstaller.ensureInstalled(
      '@vitest/browser',
      project.config.root,
    )
    const providers = (await project.runner.executeId(
      '@vitest/browser/providers',
    )) as typeof import('@vitest/browser/providers')
    const provider = (options.provider || 'preview') as
      | 'webdriverio'
      | 'playwright'
      | 'preview'
    return providers[provider]
  }

  let customProviderModule

  try {
    customProviderModule = (await project.runner.executeId(
      options.provider,
    )) as { default: BrowserProviderModule }
  }
  catch (error) {
    throw new Error(
      `Failed to load custom BrowserProvider from ${options.provider}`,
      { cause: error },
    )
  }

  if (customProviderModule.default == null) {
    throw new Error(
      `Custom BrowserProvider loaded from ${options.provider} was not the default export`,
    )
  }

  return customProviderModule.default
}
