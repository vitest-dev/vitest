import { expect, test } from 'vitest'
import { runVitest } from '#test-utils'

test('a malformed inline source map does not swallow the original test error (#10892)', async () => {
  const { errorTree } = await runVitest({
    root: './fixtures/malformed-source-map',
  }, [], { fails: true })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "external-source-map.spec.ts": {
        "reports the original module error": [
          "test error",
        ],
      },
      "inlined-source-map.spec.ts": {
        "reports the original module error": [
          "test error",
        ],
      },
    }
  `)
})
