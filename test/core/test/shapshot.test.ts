import fs from 'node:fs/promises'
import pathe from 'pathe'
import { expect, test } from 'vitest'

function println() {
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
  const path = pathe.resolve(__dirname, '../test-update/snapshots-inline-js.test.js')
  const content = await fs.readFile(path, 'utf8')
  expect(content).toMatchSnapshot()
})

test('concurrent snapshot update', async () => {
  const path = pathe.resolve(__dirname, '../test-update/inline-test-template-concurrent.test.js')
  const content = await fs.readFile(path, 'utf8')
  expect(content).toMatchSnapshot()
})
