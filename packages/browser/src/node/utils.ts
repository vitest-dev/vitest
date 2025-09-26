import type { BrowserProvider, BrowserProviderOption, ResolvedBrowserOptions, TestProject } from 'vitest/node'

export function replacer(code: string, values: Record<string, string>): string {
  return code.replace(/\{\s*(\w+)\s*\}/g, (_, key) => values[key] ?? _)
}

export async function getBrowserProvider(
  options: ResolvedBrowserOptions,
  project: TestProject,
): Promise<BrowserProvider> {
  const browser = project.config.browser.name
  const name = project.name ? `[${project.name}] ` : ''
  if (!browser) {
    throw new Error(
      `${name}Browser name is required. Please, set \`test.browser.instances[].browser\` option manually.`,
    )
  }
  if (
    // nothing is provided by default
    options.provider == null
    // the provider is provided via `--browser.provider=playwright`
    // or the config was serialized, but we can infer the factory by the name
    || ('_cli' in options.provider && typeof options.provider.providerFactory !== 'function')
  ) {
    const providers = await import('./providers/index')
    const name = (options.provider?.name || 'preview') as 'preview' | 'webdriverio' | 'playwright'
    if (!(name in providers)) {
      throw new Error(`Unknown browser provider "${name}". Available providers: ${Object.keys(providers).join(', ')}.`)
    }
    return (providers[name] as (options?: object) => BrowserProviderOption)(options.provider?.options).providerFactory(project)
  }
  const supportedBrowsers = options.provider.supportedBrowser || []
  if (supportedBrowsers.length && !supportedBrowsers.includes(browser)) {
    throw new Error(
      `${name}Browser "${browser}" is not supported by the browser provider "${
        options.provider.name
      }". Supported browsers: ${supportedBrowsers.join(', ')}.`,
    )
  }
  if (typeof options.provider.providerFactory !== 'function') {
    throw new TypeError(`The "${name}" browser provider does not provide a "factory" function. Received ${typeof options.provider.providerFactory}.`)
  }
  return options.provider.providerFactory(project)
}

export function slash(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/')
}
