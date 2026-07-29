import { expect, test } from 'vitest'

test('object', () => {
  expect({
    foo: {
      type: 'object',
      map: new Map(),
    },
  })
    .toMatchInlineSnapshot(`
        {
          "foo": {
            "map": Map {},
            "type": "object",
          },
        }
      `)
})
