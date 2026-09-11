import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

test('file fixture whose setup failed is set up again on retry', async () => {
  const { stdout, errorTree } = await runInlineTests({
    'basic.test.ts': `
      import { expect, test } from 'vitest'

      let attempts = 0

      const extended = test.extend<{ file: string }>({
        file: [
          async ({}, use) => {
            attempts++
            console.log('>> init file', attempts)
            if (attempts === 1) {
              throw new Error('setup failed once')
            }
            await use('file')
          },
          { scope: 'file' },
        ],
      })

      extended('test1', { retry: 1 }, ({ file }) => {
        expect(file).toBe('file')
      })
    `,
  })

  expect(getFixtureLogs(stdout)).toMatchInlineSnapshot(`
    ">> init file 1
    >> init file 2"
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "test1": "passed",
      },
    }
  `)
})

test('worker fixture whose setup failed does not poison the next file', async () => {
  const { stdout, errorTree } = await runInlineTests({
    'fixture.ts': `
      import { test } from 'vitest'

      let attempts = 0

      export const extended = test.extend<{ worker: string }>({
        worker: [
          async ({}, use) => {
            attempts++
            console.log('>> init worker', attempts)
            if (attempts === 1) {
              throw new Error('setup failed once')
            }
            await use('worker')
          },
          { scope: 'worker' },
        ],
      })
    `,
    '1-basic.test.ts': `
      import { extended } from './fixture'
      extended('test1', ({ worker: _worker }) => {})
    `,
    '2-basic.test.ts': `
      import { extended } from './fixture'
      extended('test1', ({ worker: _worker }) => {})
    `,
  }, {
    isolate: false,
    maxWorkers: 1,
    pool: 'threads',
    sequence: { sequencer: StableTestFileOrderSorter },
  })

  expect(getFixtureLogs(stdout)).toMatchInlineSnapshot(`
    ">> init worker 1
    >> init worker 2"
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "1-basic.test.ts": {
        "test1": [
          "setup failed once",
        ],
      },
      "2-basic.test.ts": {
        "test1": "passed",
      },
    }
  `)
})

function getFixtureLogs(stdout: string) {
  return stdout
    .split('\n')
    .filter(line => line.startsWith('>> init'))
    .join('\n')
}

class StableTestFileOrderSorter {
  sort(files: { moduleId: string }[]) {
    return files.sort((a, b) => a.moduleId.localeCompare(b.moduleId))
  }

  shard(files: { moduleId: string }[]) {
    return files
  }
}
