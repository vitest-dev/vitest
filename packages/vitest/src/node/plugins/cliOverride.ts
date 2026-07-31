import type { Plugin } from 'vite'
import type { ResolvedBrowserOptions } from '../types/browser'
import type { UserConfig } from '../types/config'
import { deepMerge } from '@vitest/utils/helpers'
import { mergeConfig } from 'vite'

export function applyCliOverrides(test: UserConfig, cliOptions: UserConfig): UserConfig {
  const { browser, ...options } = cliOptions

  // We don't want to use Vite's merge because we want to OVERRIDE options
  // By default, Vite extends arrays, for example, but CLI options should have the priority
  const merged = deepMerge({}, test, options) as UserConfig

  // apply browser CLI options only if the config already has the browser config and not disabled manually
  if (merged.browser && browser && (merged.browser.enabled !== false || browser.enabled)) {
    merged.browser = mergeConfig(
      merged.browser,
      browser,
    ) as ResolvedBrowserOptions
  }
  return merged
}

export function CliOverride(cliOptions: UserConfig): Plugin {
  return {
    // The CLI plugin overwrites config values with CLI options, making them
    // available in the next plugin. We have to do this via plugins because of watch mode.
    name: 'vitest:config:cli',
    enforce: 'pre',
    config: {
      order: 'pre',
      handler(config) {
        config.test = applyCliOverrides(config.test ?? {}, cliOptions)
      },
    },
  }
}
