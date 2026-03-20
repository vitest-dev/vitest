import { runInlineTests } from '#test-utils'
import { expect, test } from 'vitest'

test('custom vcsProvider that returns specific files runs only matching tests', async () => {
  const { testTree, stderr } = await runInlineTests({
    'vitest.config.js': `
      import path from 'node:path'
      export default {
        test: {
          experimental: {
            vcsProvider: {
              async findChangedFiles({ root }) {
                return [path.resolve(root, 'src/changed.ts')]
              },
            },
          },
        },
      }
    `,
    'src/changed.ts': 'export const a = 1',
    'src/not-changed.ts': 'export const b = 2',
    'related.test.ts': `
      import { a } from './src/changed.ts'
      import { test, expect } from 'vitest'
      test('related test', () => {
        expect(a).toBe(1)
      })
    `,
    'not-related.test.ts': `
      import { b } from './src/not-changed.ts'
      import { test, expect } from 'vitest'
      test('not related test', () => {
        expect(b).toBe(2)
      })
    `,
  }, {
    changed: true,
  })

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "related.test.ts": {
        "related test": "passed",
      },
    }
  `)
})

test('custom vcsProvider that returns no files runs no tests', async () => {
  const { testTree, stdout } = await runInlineTests({
    'vitest.config.js': `
      export default {
        test: {
          passWithNoTests: true,
          experimental: {
            vcsProvider: {
              async findChangedFiles() {
                return []
              },
            },
          },
        },
      }
    `,
    'basic.test.ts': `
      import { test, expect } from 'vitest'
      test('should not run', () => {
        expect(1).toBe(1)
      })
    `,
  }, {
    changed: true,
  })

  expect(stdout).toContain(`No test files found, exiting with code 0`)
  expect(testTree()).toMatchInlineSnapshot('{}')
})

test('custom vcsProvider that returns all files runs all tests', async () => {
  const { testTree, stderr } = await runInlineTests({
    'vitest.config.js': `
      import path from 'node:path'
      export default {
        test: {
          experimental: {
            vcsProvider: {
              async findChangedFiles({ root }) {
                return [
                  path.resolve(root, 'src/a.ts'),
                  path.resolve(root, 'src/b.ts'),
                ]
              },
            },
          },
        },
      }
    `,
    'src/a.ts': 'export const a = 1',
    'src/b.ts': 'export const b = 2',
    'first.test.ts': `
      import { a } from './src/a.ts'
      import { test, expect } from 'vitest'
      test('first test', () => {
        expect(a).toBe(1)
      })
    `,
    'second.test.ts': `
      import { b } from './src/b.ts'
      import { test, expect } from 'vitest'
      test('second test', () => {
        expect(b).toBe(2)
      })
    `,
  }, {
    changed: true,
  })

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "first.test.ts": {
        "first test": "passed",
      },
      "second.test.ts": {
        "second test": "passed",
      },
    }
  `)
})
