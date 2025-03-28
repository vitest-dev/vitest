import type { UserConfig as ViteUserConfig } from 'vite'
import type { UserConfig } from 'vitest/node'
import type { VitestRunnerCLIOptions } from '../../test-utils'
import { runVitest } from '../../test-utils'
import { browser } from '../settings'

export { browser, instances, provider } from '../settings'

export async function runBrowserTests(
  config?: Omit<UserConfig, 'browser'> & { browser?: Partial<UserConfig['browser']> },
  include?: string[],
  viteOverrides?: Partial<ViteUserConfig>,
  runnerOptions?: VitestRunnerCLIOptions,
) {
  return runVitest({
    watch: false,
    reporters: 'none',
    ...config,
    browser: {
      headless: browser !== 'safari',
      ...config?.browser,
    } as UserConfig['browser'],
  }, include, 'test', viteOverrides, runnerOptions)
}
