import { expect, test } from 'vitest'
import * as testUtils from '#test-utils'

const testFile = (name: string) => /* ts */ `
import { test } from 'vitest'
import { value } from './shared'

test('${name}', () => {
  console.log('[test] value=' + value)
})
`

test('rerun of a non-isolated pool evaluates a changed module once per worker', async () => {
  const { vitest, fs } = await testUtils.runInlineTests(
    {
      'shared.ts': /* ts */ `
console.log('[shared]')
export const value = 1
`,
      ...Object.fromEntries(
        Array.from({ length: 6 }, (_, i) => [`t${i}.test.ts`, testFile(`t${i}`)]),
      ),
    },
    { watch: true, isolate: false, maxWorkers: 2 },
  )
  const logs = (prefix: string) =>
    vitest.stdout.split('\n').filter((line) => line.startsWith(prefix))

  await vitest.waitForStdout('Waiting for file changes')
  expect(logs('[test]')).toEqual(Array.from({ length: 6 }, () => '[test] value=1'))
  expect(logs('[shared]').length).toBe(2)
  vitest.resetOutput()

  fs.editFile('shared.ts', (content) => content.replace('value = 1', 'value = 2'))
  await vitest.waitForStdout('Waiting for file changes')
  expect(logs('[test]')).toEqual(Array.from({ length: 6 }, () => '[test] value=2'))
  expect(logs('[shared]').length).toBe(2)
})
