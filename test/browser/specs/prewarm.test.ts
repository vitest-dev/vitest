import type { BrowserProviderOption } from 'vitest/node'
import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'
import { instances, provider, runInlineBrowserTests } from './utils'

function spyOnPrewarm() {
  const prewarmed: (string | undefined)[] = []
  const spyProvider: BrowserProviderOption = {
    ...provider,
    prewarm(ctx) {
      prewarmed.push(ctx.config.name)
      provider.prewarm?.(ctx)
    },
  }
  // config resolution assigns `name` on the instance objects,
  // so the shared settings array cannot be reused between runs
  const freshInstances = instances.map(instance => ({ ...instance }))
  return { prewarmed, spyProvider, freshInstances }
}

const basicTest = `
import { test } from 'vitest'
test('works', () => {})
`

test('prewarm receives only the instances matching the --project filter', async () => {
  const { prewarmed, spyProvider, freshInstances } = spyOnPrewarm()
  const target = instances[0].browser!

  const result = await runInlineBrowserTests({
    'basic.test.ts': basicTest,
  }, {
    project: [target],
    browser: { provider: spyProvider, instances: freshInstances },
  })

  expect(result.stderr).toBe('')
  expect(prewarmed).toEqual([target])
})

test('prewarm receives only the matching instances of a workspace project', async () => {
  const { prewarmed, spyProvider, freshInstances } = spyOnPrewarm()
  const target = `browser (${instances[0].browser})`

  const { stderr } = await runInlineTests({
    'basic.test.ts': basicTest,
  }, {
    watch: false,
    reporters: 'none',
    project: [target],
    projects: [
      {
        test: {
          name: 'browser',
          browser: {
            enabled: true,
            provider: spyProvider,
            instances: freshInstances,
            headless: true,
          },
        },
      },
    ],
  })

  expect(stderr).toBe('')
  expect(prewarmed).toEqual([target])
})

test('prewarm uses the provider from the resolved instance project', async () => {
  const prewarmed: { browser: string | undefined; name: string }[] = []
  const instanceProvider: BrowserProviderOption = {
    ...provider,
    prewarm(ctx) {
      prewarmed.push({
        browser: ctx.config.browser.name,
        name: ctx.config.name,
      })
      provider.prewarm?.(ctx)
    },
  }
  const target = instances[0].browser!
  const freshInstances = instances.map((instance, index) => ({
    ...instance,
    provider: index === 0 ? instanceProvider : undefined,
  }))

  const result = await runInlineBrowserTests({
    'basic.test.ts': basicTest,
  }, {
    project: [target],
    browser: { provider: undefined, instances: freshInstances },
  })

  expect(result.stderr).toBe('')
  expect(prewarmed).toEqual([{ browser: target, name: target }])
})

test('does not prewarm a project without test files', async () => {
  const { prewarmed, spyProvider } = spyOnPrewarm()
  let projectNames: string[] = []
  const browser = instances[0].browser!

  const result = await runInlineBrowserTests({
    'basic.test.ts': basicTest,
  }, {
    browser: {
      provider: spyProvider,
      instances: [
        { browser, name: 'with tests', include: ['basic.test.ts'] },
        { browser, name: 'without tests', include: ['missing.test.ts'] },
      ],
    },
    $viteConfig: {
      plugins: [
        {
          name: 'capture-projects',
          configureVitest({ project, vitest }) {
            projectNames = vitest.projects.map(project => project.name)
            if (project.name === 'without tests') {
              project.config.include = ['basic.test.ts']
            }
          },
        },
      ],
    },
  })

  expect(result.stderr).toBe('')
  expect(prewarmed).toEqual(['with tests'])
  expect(projectNames).toEqual(['with tests', 'without tests'])
  expect(result.ctx!.state.getFiles().map(file => file.projectName).sort()).toEqual(['with tests', 'without tests'])
})
