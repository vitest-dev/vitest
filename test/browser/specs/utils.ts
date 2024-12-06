import type { UserConfig as ViteUserConfig } from 'vite'
import type { UserConfig } from 'vitest/node'
import { runVitest } from '../../test-utils'

export const provider = process.env.PROVIDER || 'playwright'
export const browser = process.env.BROWSER || (provider !== 'playwright' ? 'chromium' : 'chrome')

export async function runBrowserTests(
  config?: Omit<UserConfig, 'browser'> & { browser?: Partial<UserConfig['browser']> },
  include?: string[],
  viteOverrides?: Partial<ViteUserConfig>,
  runnerOptions?: Parameters<typeof runVitest>[4],
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
