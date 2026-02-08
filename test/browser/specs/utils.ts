import type { UserConfig as ViteUserConfig } from 'vite'
import type { TestUserConfig } from 'vitest/node'
import type { RunVitestConfig, TestFsStructure, VitestRunnerCLIOptions } from '../../test-utils'
import { runInlineTests, runVitest } from '../../test-utils'
import { instances, provider } from '../settings'

export { instances, provider } from '../settings'

export async function runInlineBrowserTests(
  structure: TestFsStructure,
  config?: RunVitestConfig,
  options?: VitestRunnerCLIOptions,
) {
  return runInlineTests(
    structure,
    {
      watch: false,
      reporters: 'none',
      ...config,
      browser: {
        enabled: true,
        provider,
        instances,
        headless: true,
        ...config?.browser,
      } as TestUserConfig['browser'],
    },
    options,
  )
}

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
    browser: { headless: true, ...config?.browser },
    $viteConfig: viteOverrides,
  }, include, runnerOptions)
}
