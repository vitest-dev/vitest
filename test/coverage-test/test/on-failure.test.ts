import { expect } from 'vitest'
import { sum } from '../fixtures/src/math'
import { captureStdout, coverageTest, isV8Provider, normalizeURL, runVitest, test } from '../utils'

test('report is not generated when tests fail', async () => {
  const stdout = captureStdout()

  const { exitCode } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      all: false,
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
      all: false,
      include: ['**/fixtures/src/math.ts'],
      reporter: 'text',
      reportOnFailure: true,
    },
  }, { throwOnError: false })

  if (isV8Provider()) {
    expect(stdout()).toMatchInlineSnapshot(`
      "----------|---------|----------|---------|---------|-------------------
      File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
      ----------|---------|----------|---------|---------|-------------------
      All files |      50 |      100 |      25 |      50 |                   
       math.ts  |      50 |      100 |      25 |      50 | 6-7,10-11,14-15   
      ----------|---------|----------|---------|---------|-------------------
      "
    `)
  }
  else {
    expect(stdout()).toMatchInlineSnapshot(`
      "----------|---------|----------|---------|---------|-------------------
      File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
      ----------|---------|----------|---------|---------|-------------------
      All files |      25 |      100 |      25 |      25 |                   
       math.ts  |      25 |      100 |      25 |      25 | 6-14              
      ----------|---------|----------|---------|---------|-------------------
      "
    `)
  }

  expect(exitCode).toBe(1)
})

coverageTest('failing test', () => {
  expect(sum(1, 2)).toBe(4)
})
