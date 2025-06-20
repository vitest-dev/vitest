import { resolve } from 'pathe'
import { test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

test('when nothing is changed, run nothing but keep watching', async () => {
  const { vitest } = await runVitest({
    root: 'fixtures',
    watch: true,
    changed: true,
  })

  await vitest.waitForStdout('No affected test files found')
  await vitest.waitForStdout('Waiting for file changes...')

  editFile(resolve(__dirname, '../fixtures/math.ts'), content => `${content}\n\n`)

  await vitest.waitForStdout('RERUN  ../math.ts')
  await vitest.waitForStdout('1 passed')

  editFile(resolve(__dirname, '../fixtures/math.test.ts'), content => `${content}\n\n`)

  await vitest.waitForStdout('RERUN  ../math.test.ts')
  await vitest.waitForStdout('1 passed')
})
