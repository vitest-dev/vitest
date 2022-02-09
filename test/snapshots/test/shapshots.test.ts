const println = () => {
  const message = `
export default function () {
  function Foo() {
  }

  return Foo;
}
`
  return message
}

test('non default snapshot format', () => {
  expect({ foo: ['bar'] }).toMatchInlineSnapshot(`
  Object {
    "foo": Array [
      "bar",
    ],
  }
  `)
})

test('multiline strings ', () => {
  expect(println()).toMatchSnapshot()
})
