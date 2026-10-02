import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { editFile, runInlineTests, runVitest } from '#test-utils'

// `changed: true` is git-driven, so unlike the other watch tests this one has
// to run against a committed fixture: an inline tmp directory is either
// untracked (git reports every file as changed) or gitignored (git never
// reports its files as changed, even after edits).
test('when nothing is changed, run nothing but keep watching', async () => {
  const { vitest } = await runVitest({
    root: 'fixtures/related',
    watch: true,
    changed: true,
  })

  await vitest.waitForStdout('Waiting for file changes...')
  expect(vitest.stdout).toMatch(/No (changed|affected test) files found/)

  editFile(
    resolve(import.meta.dirname, '../../fixtures/related/math.ts'),
    (content) => `${content}\n\n`,
  )

  await vitest.waitForStdout('RERUN  ../../math.ts')
  await vitest.waitForStdout('1 passed')

  editFile(
    resolve(import.meta.dirname, '../../fixtures/related/math.test.ts'),
    (content) => `${content}\n\n`,
  )

  await vitest.waitForStdout('RERUN  ../../math.test.ts')
  await vitest.waitForStdout('1 passed')
})

test('a filter that matches no test files is reported even with related files', async () => {
  const { vitest } = await runInlineTests(
    {
      'src/a.js': 'export {}',
      'a.test.js': `
        import { test } from 'vitest'
        test('a', () => {})
      `,
    },
    { watch: true, related: ['src/a.js'], $cliFilters: ['does-not-exist'] },
  )

  await vitest.waitForStdout('Waiting for file changes...')
  expect(vitest.stdout).toContain(
    'No test files found. You can change the file name pattern by pressing "p"',
  )
})
