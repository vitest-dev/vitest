import { expect, test } from "vitest"
import { instances, runBrowserTests } from "./utils"

test('user-event-hover', async () => {
  const result = await runBrowserTests({
    root: './fixtures/user-event-hover',
  })
  expect(result.stderr).toMatchInlineSnapshot(`""`)

  const tree = result.errorTree({ project: true })
  for (const { browser } of instances) {
    expect.soft(tree[browser], browser).toMatchInlineSnapshot(`
      {
        "hover-persist.test.ts": {
          "after click": "passed",
          "click": "passed",
        },
        "hover-reset.test.ts": {
          "after click": "passed",
          "click": "passed",
        },
      }
    `)
  }
})
