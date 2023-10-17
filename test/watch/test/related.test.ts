import { test } from 'vitest'
import { resolve } from 'pathe'
import { editFile, runVitestCli } from '../../test-utils'

const cliArgs = ['--root', 'fixtures', '--watch', '--changed']

test('when nothing is changed, run nothing but keep watching', async () => {
  const vitest = await runVitestCli(...cliArgs)

  await vitest.waitForStdout('No affected test files found')
  await vitest.waitForStdout('Waiting for file changes...')

  editFile(resolve(__dirname, '../fixtures/math.ts'), content => `${content}\n\n`)

  await vitest.waitForStdout('RERUN  ../math.ts')
  await vitest.waitForStdout('1 passed')

  editFile(resolve(__dirname, '../fixtures/math.test.ts'), content => `${content}\n\n`)

  await vitest.waitForStdout('RERUN  ../math.test.ts')
  await vitest.waitForStdout('1 passed')
})
