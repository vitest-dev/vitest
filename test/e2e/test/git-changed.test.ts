import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createFile, editFile, resolvePath, runVitest, useFS } from '../../test-utils'

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
    expect(stdout).toMatch(/No (changed|affected test) files found, exiting with code 0/)
  })
})

it.skipIf(process.env.ECOSYSTEM_CI)('related correctly runs only related tests', async () => {
  const { stdout, stderr } = await runVitest({
    related: 'src/sourceA.ts',
    root: './fixtures/git-changed/related',
    globals: true,
  })

  expect(stderr).toBe('')
  expect(stdout).toContain('3 passed')
  expect(stdout).toContain('related.test.ts')
  expect(stdout).toContain('deep-related-imports.test.ts')
  expect(stdout).toContain('deep-related-exports.test.ts')
  expect(stdout).not.toContain('not-related.test.ts')
})

it.skipIf(process.env.ECOSYSTEM_CI)(
  "doesn't run any test in a workspace because there are no changes",
  async () => {
    const { stdout } = await runVitest({
      changed: true,
      root: './fixtures/git-changed/workspace',
    })

    expect(stdout).toMatch(/No (changed|affected test) files found, exiting with code 0/)
  },
)

it('fails when git cannot resolve the changed revision', async () => {
  const { stderr, exitCode } = await runVitest({
    changed: 'does-not-exist',
    root: './fixtures/git-changed/related',
  })

  expect(exitCode).toBe(1)
  expect(stderr).toContain('Command `git diff --name-only does-not-exist...HEAD` failed:')
})

it('fails when --changed is used outside of a git repository', async () => {
  // the e2e folder is inside the vitest repository, so the fixture has to live outside of it
  const { root } = useFS(join(tmpdir(), `vitest-test-${crypto.randomUUID()}`), {
    'basic.test.js': `import { test } from 'vitest'\ntest('basic', () => {})`,
  })

  const { stderr, exitCode } = await runVitest({ changed: true, root })

  expect(exitCode).toBe(1)
  expect(stderr).toMatchInlineSnapshot(`
    "Could not find Git root. Have you initialized git with \`git init\`?
    "
  `)
})

// Fixes #4674
it.skipIf(process.env.ECOSYSTEM_CI)(
  'related correctly runs only related tests inside a workspace',
  async () => {
    editFile(
      resolvePath(import.meta.url, '../fixtures/git-changed/workspace/packages/packageA/index.js'),
      (content) => `${content}\n`,
    )

    const { stdout, stderr } = await runVitest({
      changed: true,
      root: './fixtures/git-changed/workspace',
    })

    expect(stderr).toBe('')
    expect(stdout).toContain('1 passed')
    expect(stdout).toContain('packageA')
    expect(stdout).not.toContain('packageB')
  },
)
