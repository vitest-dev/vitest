import { WebdriverBrowserProvider } from '../node/browser/webdriver'
import type { BrowserConfigOptions, BrowserProviderModule } from '../types/browser'

interface Loader {
  executeId: (id: string) => Promise<{ default: BrowserProviderModule }>
}

export async function getBrowserProvider(options: BrowserConfigOptions, loader: Loader): Promise<BrowserProviderModule> {
  if (!options.provider)
    return WebdriverBrowserProvider

  let customProviderModule

  try {
    customProviderModule = await loader.executeId(options.provider)
  }
  catch (error) {
    throw new Error(`Failed to load custom BrowserProvider from ${options.provider}`, { cause: error })
  }

  if (customProviderModule.default == null)
    throw new Error(`Custom BrowserProvider loaded from ${options.provider} was not the default export`)

  return customProviderModule.default
}
