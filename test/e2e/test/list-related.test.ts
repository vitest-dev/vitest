import { expect, test } from 'vitest'
import { replaceRoot, runInlineTests, runVitestCli } from '#test-utils'

const structure = {
  'src/shared.ts': 'export const shared = true',
  'src/intermediate.ts': `
    export { shared } from './shared'
  `,
  'src/other.ts': 'export const other = true',
  'src/unrelated.ts': 'export const unrelated = true',
  'tests/direct.test.ts': `
    import { expect, test } from 'vitest'
    import { shared } from '../src/shared'

    test('direct dependency', () => {
      expect(shared).toBe(true)
    })
  `,
  'tests/transitive.test.ts': `
    import { expect, test } from 'vitest'
    import { shared } from '../src/intermediate'

    test('transitive dependency', () => {
      expect(shared).toBe(true)
    })
  `,
  'tests/other.test.ts': `
    import { expect, test } from 'vitest'
    import { other } from '../src/other'

    test('other dependency', () => {
      expect(other).toBe(true)
    })
  `,
  'tests/unrelated.test.ts': `
    import { expect, test } from 'vitest'
    import { unrelated } from '../src/unrelated'

    test('unrelated dependency', () => {
      expect(unrelated).toBe(true)
    })
  `,
}

async function setupRelatedTests() {
  const result = await runInlineTests(structure)

  expect(result.stderr).toBe('')
  expect(result.testTree()).toMatchInlineSnapshot(`
    {
      "tests/direct.test.ts": {
        "direct dependency": "passed",
      },
      "tests/other.test.ts": {
        "other dependency": "passed",
      },
      "tests/transitive.test.ts": {
        "transitive dependency": "passed",
      },
      "tests/unrelated.test.ts": {
        "unrelated dependency": "passed",
      },
    }
  `)

  return result
}

test('list --related includes direct and transitive dependents', async () => {
  const { root } = await setupRelatedTests()
  const { stdout, stderr, exitCode } = await runVitestCli(
    'list',
    `--root=${root}`,
    '--related',
    'src/shared.ts',
  )

  expect(stderr).toBe('')
  expect(stdout).toMatchInlineSnapshot(`
    "tests/direct.test.ts > direct dependency
    tests/transitive.test.ts > transitive dependency
    "
  `)
  expect(exitCode).toBe(0)
})

test('list --related combines multiple source files', async () => {
  const { root } = await setupRelatedTests()
  const { stdout, stderr, exitCode } = await runVitestCli(
    'list',
    `--root=${root}`,
    '--related',
    'src/shared.ts',
    'src/other.ts',
  )

  expect(stderr).toBe('')
  expect(stdout).toMatchInlineSnapshot(`
    "tests/direct.test.ts > direct dependency
    tests/other.test.ts > other dependency
    tests/transitive.test.ts > transitive dependency
    "
  `)
  expect(exitCode).toBe(0)
})

test('list --related supports files-only and JSON output', async () => {
  const { root } = await setupRelatedTests()
  const filesResult = await runVitestCli(
    'list',
    `--root=${root}`,
    '--related',
    '--filesOnly',
    'src/shared.ts',
  )
  const jsonResult = await runVitestCli(
    'list',
    `--root=${root}`,
    '--related',
    'src/shared.ts',
    '--json',
  )

  expect(filesResult.stderr).toBe('')
  expect(filesResult.stdout).toMatchInlineSnapshot(`
    "tests/direct.test.ts
    tests/transitive.test.ts
    "
  `)
  expect(filesResult.exitCode).toBe(0)

  expect(jsonResult.stderr).toBe('')
  expect(replaceRoot(jsonResult.stdout, root)).toMatchInlineSnapshot(`
    "[
      {
        "name": "direct dependency",
        "file": "<root>/tests/direct.test.ts"
      },
      {
        "name": "transitive dependency",
        "file": "<root>/tests/transitive.test.ts"
      }
    ]
    "
  `)
  expect(jsonResult.exitCode).toBe(0)
})
