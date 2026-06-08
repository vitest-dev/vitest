import type { TestModule } from 'vitest/node'
import { expect, it, onTestFinished, vi } from 'vitest'
import { createVitest } from 'vitest/node'

const browserProvider = {
  name: 'playwright',
  options: {},
  providerFactory() {
    return {} as never
  },
  serverFactory() {
    return {} as never
  },
}

it(createVitest, async () => {
  const onTestRunEnd = vi.fn()
  const ctx = await createVitest('test', {
    watch: false,
    root: 'fixtures/create-vitest',
    reporters: [
      {
        onTestRunEnd,
      },
    ],
  })
  onTestFinished(() => ctx.close())
  const testFiles = await ctx.globTestSpecifications()
  await ctx.runTestSpecifications(testFiles, false)

  const [testModules, errors, reason] = onTestRunEnd.mock.calls[0]
  expect(testModules).toHaveLength(1)

  const testModule = testModules[0]
  expect((testModule as TestModule).task?.name).toBe('basic.test.ts')
  expect((testModule as TestModule).state()).toBe('passed')

  expect(errors).toHaveLength(0)
  expect(reason).toBe('passed')
})

it('accepts browser config from the Node API without duplicating instances', async () => {
  const ctx = await createVitest('test', {
    watch: false,
    config: false,
    root: 'fixtures/create-vitest',
    browser: {
      enabled: true,
      headless: true,
      provider: browserProvider as any,
      instances: [{ browser: 'chromium' }],
    },
  })
  onTestFinished(() => ctx.close())

  expect(ctx.projects).toHaveLength(1)
  expect(ctx.projects[0].name).toBe('chromium')
  expect(ctx.projects[0].config.browser.enabled).toBe(true)
})
