import type { UserConfig as ViteUserConfig } from 'vite'
import type { TestUserConfig } from 'vitest/node'
import type { VitestRunnerCLIOptions } from '../../test-utils'
import { runVitest } from '../../test-utils'
import { browser } from '../settings'

export { browser, instances, provider } from '../settings'

export async function runBrowserTests(
  config?: Omit<TestUserConfig, 'browser'> & { browser?: Partial<TestUserConfig['browser']> },
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
    } as TestUserConfig['browser'],
  }, include, 'test', viteOverrides, runnerOptions)
}
