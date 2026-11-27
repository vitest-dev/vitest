import { expect, test } from 'vitest'
import { instances, runInlineBrowserTests } from './utils'

declare module 'vitest' {
  interface TaskMeta {
    starts?: string[]
    fakes?: boolean[]
  }
}

const subscriptionTests = {
  'subscription.test.js': /* js */ `
    import { expect, test, vi } from 'vitest'

    test('starts the subscription', { tags: 'simulation' }, ({ task }) => {
      task.meta.starts = [...(task.meta.starts ?? []), new Date().toISOString()]
    })

    test('real timers after the test', () => {
      expect(vi.isFakeTimers()).toBe(false)
    })
  `,
}

test('a tag with a now range starts each repeat in the browser at a date from the seed', async () => {
  const range = {
    min: new Date('2024-06-01T00:00:00.000Z'),
    max: new Date('2024-06-30T23:59:59.999Z'),
  }
  const config = {
    seed: 0,
    tags: [{ name: 'simulation', repeats: 4, fakeTimers: { now: range } }],
  }
  const first = await runInlineBrowserTests(subscriptionTests, config)
  expect(first.stderr).toBe('')
  expect(first.results).toHaveLength(instances.length)
  const second = await runInlineBrowserTests(subscriptionTests, config)

  for (const module of first.results) {
    const [testCase] = module.children.allTests()
    const starts = testCase.meta().starts ?? []
    expect(new Set(starts).size).toBe(5)
    for (const start of starts) {
      expect(Date.parse(start)).toBeGreaterThanOrEqual(range.min.getTime())
      expect(Date.parse(start)).toBeLessThanOrEqual(range.max.getTime())
    }

    const again = second.results.find((other) => other.project.name === module.project.name)
    const [repeated] = again?.children.allTests() ?? []
    expect(repeated?.meta().starts).toEqual(starts)
  }
})

test('the fakeTimers option gives the test, its aroundEach hooks and their fixtures the fake clock', async () => {
  const { stderr, results } = await runInlineBrowserTests({
    'invoice.test.js': /* js */ `
      import { expect, test as base, vi } from 'vitest'

      const leapDay = '2024-02-29T12:00:00.000Z'
      const isLeapDay = () => new Date().toISOString() === leapDay

      const test = base.extend({
        customer: async ({ task }, use) => {
          task.meta.fakes = [isLeapDay()]
          await use({})
          task.meta.fakes.push(isLeapDay())
        },
      })

      test.aroundEach(async (runTest, { task, customer }) => {
        task.meta.fakes.push(isLeapDay())
        await runTest()
        task.meta.fakes.push(isLeapDay())
      })

      test('an invoice of a leap day', { fakeTimers: { now: new Date(leapDay) } }, ({ task }) => {
        task.meta.fakes.push(isLeapDay())
      })

      test('real timers after the test', () => {
        expect(vi.isFakeTimers()).toBe(false)
      })
    `,
  })
  expect(stderr).toBe('')
  expect(results).toHaveLength(instances.length)
  for (const module of results) {
    const [testCase] = module.children.allTests()
    // the fixture, the hook, the test, the hook after the test, and the teardown of the fixture
    expect(testCase.meta().fakes, module.project.name).toEqual([true, true, true, true, true])
  }
})
