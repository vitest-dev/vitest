import type { BrowserProviderOption } from 'vitest/node'
import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'
import { instances, provider, runInlineBrowserTests } from './utils'

function spyOnPrewarm() {
  const prewarmed: (string | undefined)[][] = []
  const spyProvider: BrowserProviderOption = {
    ...provider,
    prewarm(ctx) {
      prewarmed.push(ctx.instances.map(instance => instance.name))
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

  const { stderr } = await runInlineBrowserTests({
    'basic.test.ts': basicTest,
  }, {
    project: [target],
    browser: { provider: spyProvider, instances: freshInstances },
  })

  expect(stderr).toBe('')
  expect(prewarmed).toEqual([[target]])
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
  expect(prewarmed).toEqual([[target]])
})
