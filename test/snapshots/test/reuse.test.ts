import { expect, test } from 'vitest'

test('a', () => {
  myTest1()
  myTest2()
})

test('b', () => {
  myTest1()
  myTest2()
})

function myTest1() {
  expect(7 + 7).toMatchInlineSnapshot(`14`)
}

function myTest2() {
  expect(3 + 3).toMatchInlineSnapshot(`6`)
  expect(4 + 4).toMatchInlineSnapshot(`8`)
}
