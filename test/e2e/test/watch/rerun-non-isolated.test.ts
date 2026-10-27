import { expect, test } from 'vitest'
import * as testUtils from '#test-utils'

const testFile = (name: string) => /* ts */ `
import { threadId } from 'node:worker_threads'
import { test } from 'vitest'
import { value } from './shared'

test('${name}', () => {
  console.log('[test] worker=' + process.pid + ':' + threadId + ' value=' + value)
})
`

test.for(['forks', 'threads'])(
  'rerun of a non-isolated %s pool evaluates a changed module once per worker',
  async (pool) => {
    const { vitest, fs } = await testUtils.runInlineTests(
      {
        'shared.ts': /* ts */ `
import { threadId } from 'node:worker_threads'
console.log('[shared] worker=' + process.pid + ':' + threadId)
export const value = 1
`,
        ...Object.fromEntries(
          Array.from({ length: 6 }, (_, i) => [`t${i}.test.ts`, testFile(`t${i}`)]),
        ),
      },
      { watch: true, isolate: false, maxWorkers: 2, pool },
    )
    await vitest.waitForStdout('Waiting for file changes')
    vitest.resetOutput()

    fs.editFile('shared.ts', (content) => content.replace('value = 1', 'value = 2'))
    await vitest.waitForStdout('Waiting for file changes')

    const lines = vitest.stdout.split('\n')
    const sharedRuns = lines.filter((line) => line.startsWith('[shared]'))
    const testLines = lines.filter((line) => line.startsWith('[test]'))
    const workers = new Set(testLines.map((line) => line.match(/worker=(\S+)/)![1]))

    expect(testLines.map((line) => line.split(' value=')[1])).toEqual(
      Array.from({ length: 6 }, () => '2'),
    )
    expect(sharedRuns.length).toBe(workers.size)
  },
)
