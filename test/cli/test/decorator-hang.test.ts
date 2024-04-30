import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { runVitestCli } from '../../test-utils'

it('doesn\'t hang when processing coverage', async () => {
  const { stderr } = await runVitestCli({
    cwd: resolve(process.cwd(), 'fixtures/decorator-hang'),
  }, '--no-watch')
  expect(stderr).toBe('')
})
