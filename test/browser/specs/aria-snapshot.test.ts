import { expect, test } from 'vitest'
import { instances, runBrowserTests } from './utils'

// TODO:
// - test new and update snapshot scenarios

test.for(instances.map(i => i.browser))('aria snapshot %s', async (browser) => {
  const result = await runBrowserTests({
    root: './fixtures/aria-snapshot',
    project: browser,
  })

  if (browser === 'webkit') {
    expect(result.stderr).toMatchInlineSnapshot(`""`)
    expect(result.errorTree()).toMatchInlineSnapshot(`
     {
       "basic.test.ts": {
         "expect.element aria once": "skipped",
         "expect.element aria retry": "skipped",
         "poll aria once": "skipped",
         "toMatchAriaInlineSnapshot simple": "passed",
         "toMatchAriaSnapshot simple": "passed",
       },
     }
   `)
  }
  else {
    expect(result.stderr).toMatchInlineSnapshot(`""`)
    expect(result.errorTree()).toMatchInlineSnapshot(`
     {
       "basic.test.ts": {
         "expect.element aria once": "passed",
         "expect.element aria retry": "passed",
         "poll aria once": "passed",
         "toMatchAriaInlineSnapshot simple": "passed",
         "toMatchAriaSnapshot simple": "passed",
       },
     }
   `)
  }
})
