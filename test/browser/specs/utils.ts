import type { UserConfig as ViteUserConfig } from 'vite'
import type { UserConfig } from 'vitest/node'
import { runVitest } from '../../test-utils'
import { browser } from '../settings'

export { browser, instances, provider } from '../settings'

export async function runBrowserTests(
  config?: Omit<UserConfig, 'browser'> & { browser?: Partial<UserConfig['browser']> },
  include?: string[],
  viteOverrides?: Partial<ViteUserConfig>,
) {
  return runVitest({
    watch: false,
    reporters: 'none',
    ...config,
    browser: {
      headless: browser !== 'safari',
      ...config?.browser,
    } as UserConfig['browser'],
  }, include, 'test', viteOverrides)
}
