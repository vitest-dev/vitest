import { expect, test } from 'vitest'
import { instances, provider, runBrowserTests } from './utils'

test('fails gracefully when browser crashes', async () => {
  if (provider === 'playwright') {
    const { stderr } = await runBrowserTests({
      root: './fixtures/browser-crash',
      reporters: [['verbose', { isTTY: false }]],
      browser: {
        // webkit has no support for simulating browser crash
        instances: instances.filter(item => item.name !== 'webkit'),
      },
    })

    expect(stderr).contains('Page crashed when executing tests')
  }
})
