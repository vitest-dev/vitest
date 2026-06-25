import type { Plugin } from 'vite'
import type { ResolvedBrowserOptions } from '../types/browser'
import type { UserConfig } from '../types/config'
import { deepMerge } from '@vitest/utils/helpers'
import { mergeConfig } from 'vite'

export function CliOverride(cliOptions: UserConfig): Plugin {
  return {
    // The CLI plugin overwrites config values with CLI options, making them
    // avalable in the next plugin. We have to do this via plugins because of watch mode.
    name: 'vitest:config:cli',
    enforce: 'pre',
    config: {
      order: 'pre',
      handler(config) {
        const { browser, ...options } = cliOptions

        config.test ??= {}
        // We don't want to use Vite's merge because we want to OVERRIDE options
        // By default, Vite extends arrays, for example, but CLI options should have the priority
        config.test = deepMerge({}, config.test, options)

        // apply browser CLI options only if the config already has the browser config and not disabled manually
        if (config.test.browser && browser && (config.test.browser.enabled !== false || browser.enabled)) {
          config.test.browser = mergeConfig(
            config.test.browser,
            browser,
          ) as ResolvedBrowserOptions
        }
      },
    },
  }
}
