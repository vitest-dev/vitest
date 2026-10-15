import { resolve } from 'pathe'
import { test } from 'vitest'
import { editFile, runVitest } from '#test-utils'

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

  await vitest.waitForStdout('No affected test files found')
  await vitest.waitForStdout('Waiting for file changes...')

  editFile(resolve(import.meta.dirname, '../../fixtures/related/math.ts'), content => `${content}\n\n`)

  await vitest.waitForStdout('RERUN  ../../math.ts')
  await vitest.waitForStdout('1 passed')

  editFile(resolve(import.meta.dirname, '../../fixtures/related/math.test.ts'), content => `${content}\n\n`)

  await vitest.waitForStdout('RERUN  ../../math.test.ts')
  await vitest.waitForStdout('1 passed')
})
