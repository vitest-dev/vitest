import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

test('fakeTimers.tickMode sets the tick mode of vi.useFakeTimers()', async () => {
  const { stderr, testTree } = await runInlineTests(
    {
      'tick-mode.test.ts': `
        import { afterEach, expect, test, vi } from 'vitest'

        const realSetTimeout = setTimeout

        afterEach(() => {
          vi.useRealTimers()
        })

        test('config tick mode', async () => {
          vi.useFakeTimers()
          const start = Date.now()
          await new Promise(resolve => setTimeout(resolve, 60_000))
          expect(Date.now() - start).toBe(60_000)
        })

        test('vi.useFakeTimers overrides the config tick mode', async () => {
          vi.useFakeTimers({ tickMode: 'manual' })
          const spy = vi.fn()
          setTimeout(spy, 1)
          await new Promise(resolve => realSetTimeout(resolve, 20))
          expect(spy).not.toHaveBeenCalled()
        })
      `,
    },
    { fakeTimers: { tickMode: 'nextTimerAsync' } },
  )

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "tick-mode.test.ts": {
        "config tick mode": "passed",
        "vi.useFakeTimers overrides the config tick mode": "passed",
      },
    }
  `)
})
