import { expect, test } from 'vitest'
import { instances, runInlineBrowserTests } from './utils'

async function runWithReporter() {
  const seen: (string | undefined)[] = []
  const { stderr } = await runInlineBrowserTests(
    {
      'basic.test.js': `
        import { test } from 'vitest'
        test('inner', () => {})
      `,
    },
    {
      browser: { instances: [instances[0]] },
      reporters: [
        {
          onTestCaseReady() {
            seen.push(expect.getState().currentTestName)
            expect(true).toBe(true)
          },
        },
      ],
    },
  )
  return { stderr, seen }
}

test('reporter callbacks of a browser run see the test that started it (1)', async () => {
  expect.assertions(3)
  const { stderr, seen } = await runWithReporter()
  expect(stderr).toBe('')
  expect(seen).toEqual(['reporter callbacks of a browser run see the test that started it (1)'])
})

test('reporter callbacks of a browser run see the test that started it (2)', async () => {
  expect.assertions(3)
  const { stderr, seen } = await runWithReporter()
  expect(stderr).toBe('')
  expect(seen).toEqual(['reporter callbacks of a browser run see the test that started it (2)'])
})
