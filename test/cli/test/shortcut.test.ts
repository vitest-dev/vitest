import { resolve } from 'pathe'
import { expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

it('should restart multiple browser servers', async () => {
  const root = resolve(import.meta.dirname, '../fixtures/browser-multiple')
  let initCount = 0
  const projectCount = new Map<string, number>()
  const { vitest, ctx } = await runVitest({ root, watch: true, browser: {
    enabled: true,
    provider: 'playwright',
  }, reporters: [{
    onBrowserInit(project) {
      initCount += 1
      projectCount.set(project.name, (projectCount.get(project.name) || 0) + 1)
    },
  }] })

  const projectAmount = ctx?.projects?.length

  if (projectAmount) {
    expect(initCount).toBe(1 * projectAmount)

    vitest.write('b')
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(initCount).toBe(2 * projectAmount)

    vitest.write('b')
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(initCount).toBe(3 * projectAmount)

    vitest.write('b')
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(initCount).toBe(4 * projectAmount)
  }
  else {
    throw new Error('There is no fixture with multiple projects')
  }

  expect(projectCount.size).toBe(projectAmount)
  expect(Array.from(projectCount.values()).every(value => value === initCount / projectAmount)).toBe(true)
})
