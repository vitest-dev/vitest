import { expect, test } from 'vitest'
import { runInlineTests } from '#test-utils'

test('worker fixture setup is not included in the first test duration', async () => {
  const { ctx, stderr } = await runInlineTests(
    {
      'basic.test.ts': `
        import { expect, test } from 'vitest'

        const t = test.extend({
          slow: [
            async ({}, use) => {
              await new Promise((resolve) => setTimeout(resolve, 300))
              await use(true)
            },
            { scope: 'worker' },
          ],
        })

        t('first', ({ slow }) => {
          expect(slow).toBe(true)
        })

        t('second', () => {
          expect(1).toBe(1)
        })
      `,
    },
    { maxWorkers: 1, fileParallelism: false },
  )

  expect(stderr).toBe('')

  const tests = [...ctx!.state.getTestModules()[0].children.allTests()]
  const durationByName = Object.fromEntries(
    tests.map((testCase) => [testCase.name, testCase.diagnostic()!.duration]),
  )

  expect(durationByName.first).toBeLessThan(150)
  expect(durationByName.second).toBeLessThan(100)
})
