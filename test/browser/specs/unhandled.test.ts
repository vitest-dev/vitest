import { expect, test } from 'vitest'
import { instances, runBrowserTests } from './utils'

test('prints correct unhandled error stack', async () => {
  const { stderr } = await runBrowserTests({
    root: './fixtures/unhandled',
  })

  expect(stderr).toContain('throw-unhandled-error.test.ts:9:10')

  if (instances.some(({ browser }) => browser === 'webkit')) {
    expect(stderr).toContain('throw-unhandled-error.test.ts:9:20')
  }
})
