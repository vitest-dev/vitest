import type { UserConfig as ViteUserConfig } from 'vite'
import type { TestUserConfig } from 'vitest/node'
import type { RunVitestConfig, TestFsStructure, VitestRunnerCLIOptions } from '../../test-utils'
import { runInlineTests, runVitest } from '../../test-utils'
import { instances, provider } from '../settings'

export { instances, provider } from '../settings'

// every browser instance is a worker, so `runVitest`'s default of a single
// worker would run the instances one after another
function getMaxWorkers(instanceCount: number) {
  return Math.max(instanceCount, 1)
}

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
      maxWorkers: getMaxWorkers(config?.browser?.instances?.length ?? instances.length),
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
  const result = await runVitest(
    {
      watch: false,
      reporters: 'none',
      maxWorkers: getMaxWorkers(config?.browser?.instances?.length ?? instances.length),
      ...config,
      browser: { headless: true, ...config?.browser },
      $viteConfig: viteOverrides,
    },
    include,
    runnerOptions,
  )

  return {
    ...result,
    ctx: result.ctx!,
    stderr: result.stderr.replace(
      "Testing types with tsc and vue-tsc is an experimental feature.\nBreaking changes might not follow SemVer, please pin Vitest's version when using it.\n",
      '',
    ),
  }
}
