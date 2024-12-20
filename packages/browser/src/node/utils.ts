import type { BrowserProviderModule, ResolvedBrowserOptions, TestProject } from 'vitest/node'

export function replacer(code: string, values: Record<string, string>) {
  return code.replace(/\{\s*(\w+)\s*\}/g, (_, key) => values[key] ?? _)
}

const builtinProviders = ['webdriverio', 'playwright', 'preview']

export async function getBrowserProvider(
  options: ResolvedBrowserOptions,
  project: TestProject,
): Promise<BrowserProviderModule> {
  if (options.provider == null || builtinProviders.includes(options.provider)) {
    const providers = await import('./providers')
    const provider = (options.provider || 'preview') as
      | 'webdriverio'
      | 'playwright'
      | 'preview'
    return providers[provider]
  }

  let customProviderModule

  try {
    customProviderModule = (await project.import<{ default: BrowserProviderModule }>(
      options.provider,
    ))
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

export function slash(path: string) {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/')
}
