import { test } from 'vitest'
import { runInlineTests } from '#test-utils'

test('console.log is visible on test re-run', async () => {
  const { vitest, fs } = await runInlineTests({
    'math.ts': /* ts */ `
export function sum(a: number, b: number) {
  return a + b
}
`,
    'math.test.ts': /* ts */ `
import { expect, test } from 'vitest'

import { sum } from './math'

test('sum', () => {
  expect(sum(1, 2)).toBe(3)
})
`,
  }, { watch: true })

  const testCase = `
test('test with logging', () => {
  console.log('First')
  console.log('Second')
  console.log('Third')
  expect(true).toBe(true)
})
`

  fs.editFile('math.test.ts', content => `${content}${testCase}`)

  await vitest.waitForStdout('stdout | math.test.ts > test with logging')
  await vitest.waitForStdout('First')
  await vitest.waitForStdout('Second')
  await vitest.waitForStdout('Third')
})
