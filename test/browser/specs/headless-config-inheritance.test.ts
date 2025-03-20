import { expect, test } from 'vitest'
import { provider, runBrowserTests } from './utils'

interface HeadlessConfigInheritanceTestCase {
  name: string
  rootHeadless?: boolean
  instanceHeadless?: boolean
  expectedResolvedInstanceHeadless: boolean
}

test.runIf(provider === 'playwright').each<HeadlessConfigInheritanceTestCase>([
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
  '$name(root=$rootHeadless, instance=$instanceHeadless, expected=$expectedResolvedInstanceHeadless)',
  async ({
    rootHeadless,
    instanceHeadless,
    expectedResolvedInstanceHeadless,
  }) => {
    const { ctx } = await runBrowserTests(
      {
        root: './fixtures/headless-config-inheritance',
        browser: {
          headless: rootHeadless,
          instances: [{ browser: 'chromium', headless: instanceHeadless }],
        },
      },
      [],
      {},
    )

    ctx.projects.forEach((project) => {
      // Root project is used to generate child projects, each corresponding to an instance.
      expect(
        project.config.browser.instances,
        'Project should have the sentinel value set for browser instances',
      ).toBeUndefined()
      expect(
        project.config.browser.headless,
        'Project should inherit the headless option from the root config',
      ).toBe(expectedResolvedInstanceHeadless)
      // console.log(project.config.browser);
    })
  },
)
