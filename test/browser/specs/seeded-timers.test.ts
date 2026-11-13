import { expect, test } from 'vitest'
import { instances, runInlineBrowserTests } from './utils'

declare module 'vitest' {
  interface TaskMeta {
    calls?: string[][]
  }
}

const dialogTests = {
  'dialog.test.js': /* js */ `
    import { afterEach, test, vi } from 'vitest'

    afterEach(() => {
      vi.useRealTimers()
    })

    test('fades in the dialog', { repeats: 9 }, ({ task }) => {
      vi.useFakeTimers({ now: 0, jitter: 40 })
      const calls = []
      requestAnimationFrame(() => calls.push('opacity ' + Date.now()))
      requestAnimationFrame(() => calls.push('transform ' + Date.now()))
      setTimeout(() => calls.push('focus ' + Date.now()), 20)
      vi.advanceTimersByTime(100)
      task.meta.calls = [...(task.meta.calls ?? []), calls]
    })
  `,
}

test('jitter in the browser keeps the callbacks of a frame together, and the seed repeats the times', async () => {
  const first = await runInlineBrowserTests(dialogTests, { seed: 0 })
  expect(first.stderr).toBe('')
  expect(first.results).toHaveLength(instances.length)
  const second = await runInlineBrowserTests(dialogTests, { seed: 0 })

  for (const module of first.results) {
    const [testCase] = module.children.allTests()
    const calls = testCase.meta().calls ?? []
    expect(calls).toHaveLength(10)
    for (const run of calls) {
      const names = run.map((call) => call.split(' ')[0])
      const times = Object.fromEntries(
        run.map((call) => [call.split(' ')[0], Number(call.split(' ')[1])]),
      )
      expect(names.indexOf('transform')).toBe(names.indexOf('opacity') + 1)
      expect(times.transform).toBe(times.opacity)
      expect(times.opacity).toBeOneOf([16, 32, 48])
      expect(times.focus).toBeGreaterThanOrEqual(20)
      expect(times.focus).toBeLessThanOrEqual(60)
    }
    expect(new Set(calls.map(String)).size).toBeGreaterThan(1)

    const again = second.results.find((other) => other.project.name === module.project.name)
    const [repeated] = again?.children.allTests() ?? []
    expect(repeated?.meta().calls).toEqual(calls)
  }
})
