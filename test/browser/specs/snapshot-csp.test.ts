import { expect, test } from 'vitest'
import { runBrowserTests } from './utils'

// Regression test for the `no-unsafe-eval` CSP fix: reading an existing
// snapshot file used to evaluate its content in the browser via `new Function`,
// which a `script-src 'self'` Content-Security-Policy blocks. Snapshot files are
// now evaluated server-side, so the matchers below pass even under the CSP.
test('snapshots pass under a no-unsafe-eval CSP', async () => {
  const result = await runBrowserTests({
    root: './fixtures/snapshot-csp',
  })

  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "file snapshot under CSP": "passed",
        "inline snapshot under CSP": "passed",
      },
    }
  `)
})
