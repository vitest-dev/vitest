import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { runVitestCli } from '../../test-utils'

it('run tests even though they are inside the .cache directory', async () => {
  const { stderr } = await runVitestCli({
    nodeOptions: { cwd: resolve(process.cwd(), 'fixtures/dotted-files/.cache/projects/test') },
  }, '--no-watch')
  expect(stderr).toBe('')
})
