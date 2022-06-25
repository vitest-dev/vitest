import fs from 'fs/promises'
import pathe from 'pathe'
import { expect, test } from 'vitest'

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

test('updateInlineSnapshot should not remove end whitespace', () => {
  // issue #922
  expect(`
my string
`).toMatchInlineSnapshot(`
  "
  my string
  "
`)
})

test('js snapshots generated correctly', async () => {
  const path = pathe.resolve(__dirname, '../test-update/shapshots-inline-js.test.js')
  const content = await fs.readFile(path, 'utf8')
  expect(content).toMatchSnapshot()
})
