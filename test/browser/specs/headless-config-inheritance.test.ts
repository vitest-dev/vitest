import { expect, test } from 'vitest'
import { runInlineTests, ts } from '../../test-utils'
import { instances, provider } from './utils'

interface HeadlessConfigInheritanceTestCase {
  name: string
  rootHeadless?: boolean
  instanceHeadless?: boolean
  expectedResolvedInstanceHeadless: boolean
}

test.each<HeadlessConfigInheritanceTestCase>([
  {
    name: 'instance headless is used if root headless is not set',
    rootHeadless: undefined,
    instanceHeadless: true,
    expectedResolvedInstanceHeadless: true,
  },
  {
    name: 'instance headless is used if root headless is not set',
    rootHeadless: undefined,
    instanceHeadless: false,
    expectedResolvedInstanceHeadless: false,
  },
  {
    name: 'root headless is used if instance headless is not set',
    rootHeadless: true,
    instanceHeadless: undefined,
    expectedResolvedInstanceHeadless: true,
  },
  {
    name: 'root headless is used if instance headless is not set',
    rootHeadless: false,
    instanceHeadless: undefined,
    expectedResolvedInstanceHeadless: false,
  },
  {
    name: 'both set to the same value',
    rootHeadless: true,
    instanceHeadless: true,
    expectedResolvedInstanceHeadless: true,
  },
  {
    name: 'both set to the same value',
    rootHeadless: false,
    instanceHeadless: false,
    expectedResolvedInstanceHeadless: false,
  },
  {
    name: 'instance headless overrides root headless',
    rootHeadless: true,
    instanceHeadless: false,
    expectedResolvedInstanceHeadless: false,
  },
  {
    name: 'instance headless overrides root headless',
    rootHeadless: false,
    instanceHeadless: true,
    expectedResolvedInstanceHeadless: true,
  },
])(
  '$name (root=$rootHeadless, instance=$instanceHeadless, expected=$expectedResolvedInstanceHeadless)',
  async ({
    rootHeadless,
    instanceHeadless,
    expectedResolvedInstanceHeadless,
  }) => {
    expect(instances.length).toBeGreaterThan(0)

    const { ctx } = await runInlineTests({
      'vitest.config.ts': ts`
        import { fileURLToPath } from 'node:url'
        import { defineConfig } from 'vitest/config'
        import instance from './instance.json'

        export default defineConfig({
          test: {
            browser: {
              enabled: true,
              provider: '${provider}',
              headless: ${rootHeadless},
              instances: [
                instance,
              ],
            },
          },
          cacheDir: fileURLToPath(new URL('./node_modules/.vite', import.meta.url)),
        })
      `,

      // Can also change this to pass the object directly, but would need to modify the
      // type signature in `useFS()` to accept a `BrowserInstance` type like this:
      // `structure: Record<string, ... | BrowserInstance>`.
      'instance.json': JSON.stringify({
        ...instances[0],
        headless: instanceHeadless,
      }, null, 2),

      // Below test is not technically required because we just need to check the vitest
      // config output is correct. We don't need to run any tests.
      'pass.test.ts': ts`
        import { test, expect } from 'vitest'

        test("pass", () => {
          expect(true).toBe(true)
        })
      `,
    }, {
      watch: false,
      reporters: 'none',
    })

    expect(
      ctx.projects.length,
      'One browser instance should create a single corresponding child project',
    ).toBe(1)

    const project = ctx.projects[0]
    expect(
      project.config.browser.instances,
      'Child project should have the sentinel value set for browser instances',
    ).toBeUndefined()
    expect(
      project.config.browser.headless,
      'Child project should inherit the headless option from the browser instance config or fallback to root config',
    ).toBe(expectedResolvedInstanceHeadless)
  },
)
