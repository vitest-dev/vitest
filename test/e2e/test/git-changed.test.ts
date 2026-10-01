import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createFile, editFile, resolvePath, runVitest } from '../../test-utils'

const fileName = 'fixtures/git-changed/related/rerun.temp'

// NOTE: if there are any changes in fixtures/git-changed,
// most tests will probably fail

// ecosystem-ci updated package.json and make this test fail
describe.skipIf(process.env.ECOSYSTEM_CI)('forceRerunTrigger', () => {
  async function run() {
    return runVitest({
      root: join(process.cwd(), 'fixtures/git-changed/related'),
      include: ['related.test.ts'],
      forceRerunTriggers: ['**/rerun.temp/**'],
      changed: true,
    })
  }

  it('should run the whole test suite if file exists', async () => {
    createFile(fileName, '')
    const { stdout, stderr } = await run()
    expect(stderr).toBe('')
    expect(stdout).toContain('1 passed')
    expect(stdout).toContain('related.test.ts')
    expect(stdout).not.toContain('not-related.test.ts')
  })

  it('should run no tests if file does not exist', async () => {
    const { stdout } = await run()
    expect(stdout).toContain('No test files found, exiting with code 0')
  })
})

it.skipIf(process.env.ECOSYSTEM_CI)('related correctly runs only related tests', async () => {
  const { stderr, testTree } = await runVitest({
    related: 'src/sourceA.ts',
    root: './fixtures/git-changed/related',
    globals: true,
  })

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "deep-related-exports.test.ts": {
        "values": "passed",
      },
      "deep-related-imports.test.ts": {
        "values": "passed",
      },
      "related.test.ts": {
        "A equals A": "passed",
      },
    }
  `)
})

it.skipIf(process.env.ECOSYSTEM_CI)(
  "doesn't run any test in a workspace because there are no changes",
  async () => {
    const { stdout } = await runVitest({
      changed: true,
      root: './fixtures/git-changed/workspace',
    })

    expect(stdout).toContain('No test files found, exiting with code 0')
  },
)

// Fixes #4674
it.skipIf(process.env.ECOSYSTEM_CI)(
  'related correctly runs only related tests inside a workspace',
  async () => {
    editFile(
      resolvePath(import.meta.url, '../fixtures/git-changed/workspace/packages/packageA/index.js'),
      (content) => `${content}\n`,
    )

    const { stderr, testTree } = await runVitest({
      changed: true,
      root: './fixtures/git-changed/workspace',
    })

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "index.test.js": {
          "getLetter": {
            "should return c": "passed",
          },
        },
      }
    `)
  },
)
