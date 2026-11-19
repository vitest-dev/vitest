import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createFile,
  editFile,
  resolvePath,
  runVitest,
  runVitestCli,
  useFS,
  useTmpFS,
} from '../../test-utils'

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
  expect(stderr).toContain('Command `git diff --name-only -z does-not-exist...HEAD` failed:')
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

it('finds changed files with names that git quotes', async () => {
  const { root, editFile } = useTmpFS({
    'src/café/menu.js': 'export const menu = 1',
    'src/größe.js': 'export const size = 1',
    'menu.test.js': `import { menu } from './src/café/menu.js'\nimport { test } from 'vitest'\ntest('menu', () => {})`,
    'größe.test.js': `import { size } from './src/größe.js'\nimport { test } from 'vitest'\ntest('size', () => {})`,
    'naïve.test.js': `import { test } from 'vitest'\ntest('naive', () => {})`,
    'other.test.js': `import { test } from 'vitest'\ntest('other', () => {})`,
  })
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'ignore' })

  git('init')
  git('config', 'user.name', 'vitest')
  git('config', 'user.email', 'vitest@test')
  git('config', 'commit.gpgsign', 'false')
  git('add', '-A')
  git('commit', '-m', 'base')
  editFile('src/café/menu.js', (content) => `${content}\n`)
  git('commit', '-am', 'committed change')
  editFile('src/größe.js', (content) => `${content}\n`)
  git('add', 'src/größe.js')
  editFile('naïve.test.js', (content) => `${content}\n`)

  const { stderr, testTree } = await runVitest({ changed: 'HEAD~1', root })

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "größe.test.js": {
        "size": "passed",
      },
      "menu.test.js": {
        "menu": "passed",
      },
      "naïve.test.js": {
        "naive": "passed",
      },
    }
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

const relatedChangedFiles = ['changed.test.js', 'other.test.js', 'untouched.test.js'] as const

function selectedTests(stdout: string) {
  return relatedChangedFiles.filter((file) => stdout.includes(file))
}

function relatedChangedRepo() {
  const fs = useTmpFS({
    '.gitignore': 'node_modules\n',
    'src/changed.js': 'export const value = 1\n',
    'src/other.js': 'export const other = 2\n',
    'changed.test.js': `
      import { value } from './src/changed.js'
      import { expect, test } from 'vitest'
      test('imports changed', () => {
        expect(value).toBe(1)
      })
    `,
    'other.test.js': `
      import { other } from './src/other.js'
      import { expect, test } from 'vitest'
      test('imports other', () => {
        expect(other).toBe(2)
      })
    `,
    'untouched.test.js': `
      import { expect, test } from 'vitest'
      test('untouched', () => {
        expect(1).toBe(1)
      })
    `,
  })
  const git = (...args: string[]) => execFileSync('git', args, { cwd: fs.root, stdio: 'ignore' })
  git('init')
  git('config', 'user.name', 'vitest')
  git('config', 'user.email', 'vitest@test')
  git('config', 'commit.gpgsign', 'false')
  git('add', '-A')
  git('commit', '-m', 'base')
  fs.editFile('src/changed.js', (content) => `${content}\n`)
  return fs.root
}

function runCli(root: string, ...args: string[]) {
  // verbose prints passing filenames; the default reporter hides them outside a TTY
  return runVitestCli({ nodeOptions: { cwd: root } }, ...args, '--reporter=verbose')
}

it('related --changed with no files selects the same tests as run --changed', async () => {
  const root = relatedChangedRepo()

  const related = await runCli(root, 'related', '--changed', 'HEAD')
  const run = await runCli(root, 'run', '--changed', 'HEAD')

  expect(related.stderr).toBe('')
  expect(related.exitCode).toBe(0)
  expect(selectedTests(related.stdout)).toEqual(['changed.test.js'])
  expect(related.stdout).toContain('1 of 3 test files')
  expect(related.stdout).toContain('related to 1 changed file')

  expect(run.stderr).toBe('')
  expect(run.exitCode).toBe(0)
  expect(selectedTests(run.stdout)).toEqual(selectedTests(related.stdout))
  expect(run.stdout).toContain('1 of 3 test files')
  expect(run.stdout).toContain('related to 1 changed file')
}, 120_000)

it('related with an explicit file ignores other dirty files', async () => {
  const root = relatedChangedRepo()

  const explicit = await runCli(root, 'related', 'src/other.js')
  expect(explicit.stderr).toBe('')
  expect(explicit.exitCode).toBe(0)
  expect(selectedTests(explicit.stdout)).toEqual(['other.test.js'])
  expect(explicit.stdout).toContain('related to src/other.js')

  const withChanged = await runCli(root, 'related', 'src/other.js', '--changed', 'HEAD')
  expect(withChanged.stderr).toBe('')
  expect(withChanged.exitCode).toBe(0)
  expect(selectedTests(withChanged.stdout)).toEqual(['other.test.js'])
}, 120_000)

it('related with no files and no --changed exits 0 without running tests', async () => {
  const root = relatedChangedRepo()

  const { stdout, stderr, exitCode } = await runCli(root, 'related')

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
  expect(stdout).toContain('No changed files found, exiting with code 0')
  expect(selectedTests(stdout)).toEqual([])
}, 60_000)
