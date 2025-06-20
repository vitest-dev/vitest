import { expect } from 'vitest'
import { sum } from '../fixtures/src/math'
import { captureStdout, coverageTest, normalizeURL, runVitest, test } from '../utils'

test('report is not generated when tests fail', async () => {
  const stdout = captureStdout()

  const { exitCode } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      include: ['**/fixtures/src/math.ts'],
      reporter: 'text',
    },
  }, { throwOnError: false })

  expect(stdout()).toBe('')
  expect(exitCode).toBe(1)
})

test('report is generated when tests fail and { reportOnFailure: true }', async () => {
  const stdout = captureStdout()

  const { exitCode } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      include: ['**/fixtures/src/math.ts'],
      reporter: 'text',
      reportOnFailure: true,
    },
  }, { throwOnError: false })

  expect(stdout()).toMatchInlineSnapshot(`
    "----------|---------|----------|---------|---------|-------------------
    File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
    ----------|---------|----------|---------|---------|-------------------
    All files |      25 |      100 |      25 |      25 |                   
     math.ts  |      25 |      100 |      25 |      25 | 6-14              
    ----------|---------|----------|---------|---------|-------------------
    "
  `)

  expect(exitCode).toBe(1)
})

coverageTest('failing test', () => {
  expect(sum(1, 2)).toBe(4)
})
