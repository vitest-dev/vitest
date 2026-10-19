import crypto from 'node:crypto'
import { resolve } from 'pathe'
import { expect, onTestFinished, test, vi } from 'vitest'
import { createVitest } from 'vitest/node'
import { runInlineTests, useFS } from '#test-utils'

const testFile = `
  import { test } from 'vitest'
  test('basic', () => {})
`

function affectedSummary(stdout: string) {
  return stdout.split('\n').find((line) => line.includes('Affected'))
}

test('custom vcsProvider that returns specific files runs only matching tests', async () => {
  const { testTree, stderr, stdout } = await runInlineTests(
    {
      'vitest.config.js': `
      import path from 'node:path'
      export default {
        test: {
          experimental: {
            vcsProvider: {
              async findChangedFiles({ root }) {
                return [path.resolve(root, 'src', 'changed.ts')]
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
    },
    {
      changed: true,
    },
  )

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "related.test.ts": {
        "related test": "passed",
      },
    }
  `)
  expect(affectedSummary(stdout)).toMatchInlineSnapshot(
    `"   Affected  1 of 2 test files (related to 1 changed file)"`,
  )
})

test('related prints how many test files were affected', async () => {
  const { testTree, stderr, stdout } = await runInlineTests(
    {
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
    },
    {
      related: ['src/changed.ts'],
    },
  )

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "related.test.ts": {
        "related test": "passed",
      },
    }
  `)
  expect(affectedSummary(stdout)).toMatchInlineSnapshot(
    `"   Affected  1 of 2 test files (related to src/changed.ts)"`,
  )
})

test('custom vcsProvider that returns no files runs no tests', async () => {
  const { testTree, stdout } = await runInlineTests(
    {
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
    },
    {
      changed: true,
    },
  )

  expect(noTestsMessage(stdout)).toMatchInlineSnapshot(
    `"No changed files found, exiting with code 0"`,
  )
  expect(testTree()).toMatchInlineSnapshot('{}')
})

test('changed files that no test imports are reported as not affecting any test', async () => {
  const { stdout, stderr, exitCode } = await runInlineTests(
    {
      'vitest.config.js': vcsConfig(['src/unused.js']),
      'src/unused.js': 'export {}',
      'a.test.js': testFile,
      'b.test.js': testFile,
    },
    { changed: true },
  )

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
  expect(noTestsMessage(stdout)).toMatchInlineSnapshot(
    `"No affected test files found, exiting with code 0"`,
  )
})

test('a related file that no test imports fails without passWithNoTests', async () => {
  const { stderr, exitCode } = await runInlineTests(
    {
      'src/unused.js': 'export {}',
      'basic.test.js': testFile,
    },
    { related: ['src/unused.js'] },
  )

  expect(exitCode).toBe(1)
  expect(noTestsMessage(stderr)).toMatchInlineSnapshot(
    `"No affected test files found, exiting with code 1"`,
  )
})

test('a filter that matches no test files is reported even with changed files', async () => {
  const { stderr, exitCode } = await runInlineTests(
    {
      'vitest.config.js': vcsConfig([]),
      'basic.test.js': testFile,
    },
    { changed: true, passWithNoTests: false, $cliFilters: ['does-not-exist'] },
  )

  expect(exitCode).toBe(1)
  expect(noTestsMessage(stderr)).toMatchInlineSnapshot(`
    "No test files found, exiting with code 1
    filter: does-not-exist"
  `)
})

function vcsConfig(changed: string[]) {
  return `
    import { resolve } from 'node:path'
    export default {
      test: {
        experimental: {
          vcsProvider: {
            async findChangedFiles({ root }) {
              return ${JSON.stringify(changed)}.map((file) => resolve(root, file))
            },
          },
        },
      },
    }
  `
}

function noTestsMessage(output: string) {
  return output
    .split('\n')
    .filter((line) => /No .* found|filter:/.test(line))
    .join('\n')
}

test('custom vcsProvider that returns all files runs all tests', async () => {
  const { testTree, stderr } = await runInlineTests(
    {
      'vitest.config.js': `
      import path from 'node:path'
      export default {
        test: {
          experimental: {
            vcsProvider: {
              async findChangedFiles({ root }) {
                return [
                  path.resolve(root, 'src', 'a.ts'),
                  path.resolve(root, 'src', 'b.ts'),
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
    },
    {
      changed: true,
    },
  )

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
    findChangedFiles: vi.fn(async () => {
      return []
    }),
  }
  const v = await vitest({
    experimental: {
      vcsProvider: customProvider,
    },
  })
  const files = await v.vcs.findChangedFiles({ root: v.config.root })
  expect(files).toEqual([])
  expect(customProvider.findChangedFiles).toHaveBeenCalledOnce()
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
  const v = await createVitest(
    'test',
    { watch: false, config: false, root, experimental: { vcsProvider: './my-vcs-provider.ts' } },
    {},
  )
  onTestFinished(() => v.close())
  expect(v.config.experimental.vcsProvider).toBe(resolve(root, 'my-vcs-provider.ts'))
  expect(v.vcs).toBeDefined()
  expect(typeof v.vcs.findChangedFiles).toBe('function')
})
