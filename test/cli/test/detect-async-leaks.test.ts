import { expect, test } from 'vitest'
import { glob } from 'fast-glob'
import { runVitestCli } from '../../test-utils'

const files = glob.sync('fixtures/detect-async-leaks/*.test.ts')

test.each(files)('should detect hanging operations - %s', async (file) => {
  const { stdout } = await runVitestCli(
    'run',
    '--root',
    'fixtures/detect-async-leaks',
    '--detectAsyncLeaks',
    file,
  )

  expect(stdout).toMatchSnapshot()
})
