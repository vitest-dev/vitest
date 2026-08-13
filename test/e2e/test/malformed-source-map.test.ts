import { expect, test } from 'vitest'
import { runVitest } from '#test-utils'

test('reports errors from modules with malformed inline source maps (#10892)', async () => {
  const { errorTree } = await runVitest({
    root: './fixtures/malformed-source-map',
  }, [], { fails: true })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "external-module.spec.ts": {
        "reports the original module error": [
          "test error",
        ],
      },
      "inlined-module.spec.ts": {
        "reports the original module error": [
          "test error",
        ],
      },
    }
  `)
})
