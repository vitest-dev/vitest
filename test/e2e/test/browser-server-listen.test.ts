import type { TestUserConfig } from 'vitest/node'
import { expect, onTestFinished, test } from 'vitest'
import { createVitest } from 'vitest/node'

// browser config is in the fixture, CLI `instances` do not define projects
function createBrowserVitest(config: TestUserConfig = {}) {
  return createVitest('test', {
    root: 'fixtures/browser-server-listen',
    watch: false,
    reporters: [{}],
    ...config,
  })
}

test(
  'the browser server binds its port on the first browser launch',
  { tags: ['browser'] },
  async () => {
    const ctx = await createBrowserVitest()
    onTestFinished(() => ctx.close())
    expect(ctx.vite.httpServer?.listening).toBe(false)

    // static collection does not launch a browser
    const specifications = await ctx.globTestSpecifications()
    await ctx.parseSpecifications(specifications)
    expect(ctx.vite.httpServer?.listening).toBe(false)

    const { testModules } = await ctx.runTestSpecifications(specifications, false)
    expect(ctx.vite.httpServer?.listening).toBe(true)
    expect(testModules.map((testModule) => testModule.state())).toEqual(['passed'])
  },
)

test(
  'the browser server listens on startup when the API is requested',
  { tags: ['browser'] },
  async () => {
    const ctx = await createBrowserVitest({ api: true })
    onTestFinished(() => ctx.close())
    expect(ctx.vite.httpServer?.listening).toBe(true)
  },
)
