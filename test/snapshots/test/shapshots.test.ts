test('non default snapshot format', () => {
  expect({ foo: ['bar'] }).toMatchInlineSnapshot(`
  Object {
    "foo": Array [
      "bar",
    ],
  }
  `)
})
