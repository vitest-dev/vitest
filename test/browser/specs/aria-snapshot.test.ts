import { expect, test } from 'vitest'
import { instances, runBrowserTests } from './utils'

// TODO:
// - fix firefox
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
  else if (browser === 'firefox') {
    expect(result.stderr).toMatchInlineSnapshot(`
     "
     ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

      FAIL  |firefox| basic.test.ts > expect.element aria once
     Error: toMatchDomainInlineSnapshot with different snapshots cannot be called at the same location

     Failure screenshot:
       - fixtures/aria-snapshot/__screenshots__/basic.test.ts/expect-element-aria-once-1.png

     - Expected
     + Received


     - - paragraph: poll once
     + - button: Save
     + - button: Cancel


      ❯ basic.test.ts:47:48
          45|     </main>
          46|   \`
          47|   await expect.element(page.getByTestId('nav')).toMatchAriaInlineSnaps…
            |                                                ^
          48|     - button: Save
          49|     - button: Cancel

     Caused by: Error: Matcher did not succeed in time.
      ❯ promise callback* basic.test.ts:47:48

     ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

      FAIL  |firefox| basic.test.ts > expect.element aria retry
     Error: toMatchDomainInlineSnapshot with different snapshots cannot be called at the same location

     Failure screenshot:
       - fixtures/aria-snapshot/__screenshots__/basic.test.ts/expect-element-aria-retry-1.png

     - Expected
     + Received


     - - paragraph: poll once
     + - button: Save
     + - button: Cancel


      ❯ basic.test.ts:70:48
          68|     \`
          69|   }, 100)
          70|   await expect.element(page.getByTestId('nav')).toMatchAriaInlineSnaps…
            |                                                ^
          71|     - button: Save
          72|     - button: Cancel

     Caused by: Error: Matcher did not succeed in time.
      ❯ promise callback* basic.test.ts:70:48

     ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯

     "
   `)
    expect(result.errorTree()).toMatchInlineSnapshot(`
     {
       "basic.test.ts": {
         "expect.element aria once": [
           "toMatchDomainInlineSnapshot with different snapshots cannot be called at the same location",
         ],
         "expect.element aria retry": [
           "toMatchDomainInlineSnapshot with different snapshots cannot be called at the same location",
         ],
         "poll aria once": "passed",
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
