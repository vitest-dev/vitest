import { expect, test } from 'vitest'
import { runVitest } from '#test-utils'

test('reports errors from modules with malformed source maps (#10892)', async () => {
  const { errorTree } = await runVitest({
    root: './fixtures/malformed-source-map',
  }, [], { fails: true })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "external-map.spec.ts": {
        "reports the original module error": [
          "test error",
        ],
      },
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
