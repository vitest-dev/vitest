import { expect, test } from 'vitest'
// @ts-expect-error no type
import * as lib from './fixtures/named-overwrite-all/main.js'

test('named exports overwrite export all', async () => {
  expect(lib).toMatchInlineSnapshot(`
    {
      "a": "main-a",
      "b": "dep1-b",
      "c": "main-c",
      "d": "dep1-d",
    }
  `)
})
