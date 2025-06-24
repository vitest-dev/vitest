import type { TestProject } from 'vitest/node'
import { resolve } from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import { runVitest } from '../../test-utils'

describe('restart browser servers with watch', () => {
  it('should restart multiple browser servers', async () => {
    const root = resolve(import.meta.dirname, '../fixtures/browser-multiple')
    const projects: TestProject[] = []
    const { vitest, ctx } = await runVitest({ root, watch: true, browser: {
      enabled: true,
      provider: 'playwright',
    }, reporters: [{
      onBrowserInit(project) {
        projects.push(project)
      },
    }] })
    const RESTART_COUNT = 5

    const initSpies = projects.map(project => vi.spyOn(project, '_initBrowserServer'))
    initSpies.forEach(spy => expect(spy).toHaveBeenCalledTimes(0))

    for (let i = 0; i < RESTART_COUNT; i++) {
      const closeSpies = ctx?.projects.map(project => vi.spyOn(project.browser!, 'close'))
      closeSpies!.forEach(spy => expect(spy).toHaveBeenCalledTimes(0))

      vitest.write('b')
      await new Promise(resolve => setTimeout(resolve, 10))

      closeSpies!.forEach(spy => expect(spy).toHaveBeenCalledTimes(1))
      initSpies.forEach(spy => expect(spy).toHaveBeenCalledTimes(i + 1))
    }
  })

  it('should replace new browser server', async () => {
    const root = resolve(import.meta.dirname, '../fixtures/browser-multiple')
    const { vitest, ctx } = await runVitest({ root, watch: true, browser: {
      enabled: true,
      provider: 'playwright',
    } })
    const originalBrowsers = ctx?.projects.map(p => p.browser)
    await vitest.waitForStdout('Waiting for file changes')

    vitest.write('b')
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(ctx?.projects.map(p => p.browser)).not.toBe(originalBrowsers)
  })
})
