import crypto from 'node:crypto'
import { runInlineTests, useFS } from '#test-utils'
import { resolve } from 'pathe'
import { expect, onTestFinished, test } from 'vitest'
import { createVitest } from 'vitest/node'

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

function createRoot(structure: Record<string, string>) {
  const root = resolve(process.cwd(), `vitest-test-${crypto.randomUUID()}`)
  useFS(root, structure)
  return root
}

async function vitest(config: Parameters<typeof createVitest>[1]) {
  const v = await createVitest('test', { ...config, watch: false, config: false }, {})
  onTestFinished(() => v.close())
  return v
}

test('vcsProvider defaults to GitVCSProvider when not specified', async () => {
  const v = await vitest({})
  expect(v.config.experimental.vcsProvider).toBeUndefined()
  expect(v.vcs).toBeDefined()
  expect(v.vcs.constructor.name).toBe('GitVCSProvider')
})

test('vcsProvider "git" resolves to GitVCSProvider', async () => {
  const v = await vitest({
    experimental: {
      vcsProvider: 'git',
    },
  })
  expect(v.config.experimental.vcsProvider).toBe('git')
  expect(v.vcs.constructor.name).toBe('GitVCSProvider')
})

test('vcsProvider object is used directly', async () => {
  const customProvider = {
    async findChangedFiles() {
      return []
    },
  }
  const v = await vitest({
    experimental: {
      vcsProvider: customProvider,
    },
  })
  expect(v.vcs.findChangedFiles).toBe(customProvider.findChangedFiles)
  expect(v.config.experimental.vcsProvider).toBe(v.vcs)
})

test('vcsProvider string path is resolved to absolute path', async () => {
  const root = createRoot({
    'my-vcs-provider.ts': `
      export default {
        async findChangedFiles() {
          return []
        },
      }
    `,
  })
  const v = await createVitest('test', { watch: false, config: false, root, experimental: { vcsProvider: './my-vcs-provider.ts' } }, {})
  onTestFinished(() => v.close())
  expect(v.config.experimental.vcsProvider).toBe(resolve(root, 'my-vcs-provider.ts'))
  expect(v.vcs).toBeDefined()
  expect(typeof v.vcs.findChangedFiles).toBe('function')
})
