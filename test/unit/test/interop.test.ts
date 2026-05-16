import { expect,  test } from "vitest"
// @ts-expect-error no type
import * as esModule from "@vitest/test-dep-cjs/esmodule"
// @ts-expect-error no type
import * as esModuleFalse from "@vitest/test-dep-cjs/esmodule-false"

test('interop', async () => {
  expect(esModule). toMatchInlineSnapshot(`
    {
      "__esModule": true,
      "test": "hello",
    }
  `)
  expect(esModuleFalse). toMatchInlineSnapshot(`
    {
      "__esModule": false,
      "default": {
        "__esModule": false,
        "test": "hello",
      },
      "module.exports": {
        "__esModule": false,
        "test": "hello",
      },
      "test": "hello",
    }
  `)
})
