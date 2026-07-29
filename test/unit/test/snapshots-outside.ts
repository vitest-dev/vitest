import { expect } from 'vitest'

export function testOutsideInlineSnapshot() {
  return (() => {
    expect({ foo: 'bar' }).toMatchInlineSnapshot(`
    {
      "foo": "bar",
    }
    `)
  })()
}
