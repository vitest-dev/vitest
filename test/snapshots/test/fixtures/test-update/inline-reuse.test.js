import { expect, test } from 'vitest'

// when snapshots are generated Vitest reruns `toMatchInlineSnapshot` checks
// please, don't commit generated snapshots
test('a', () => {
  myTest1()
  myTest2()
  myTest3()
})

test('b', () => {
  myTest1()
  myTest2()
  myTest3()
})


function myTest1() {
  expect(7 + 7).toMatchInlineSnapshot()
}

function myTest2() {
  expect(3 + 3).toMatchInlineSnapshot()
  expect(4 + 4).toMatchInlineSnapshot()
}

function myTest3() {
  expect(5 + 5).toMatchInlineSnapshot(`"10"`)
  expect(5 + 6).toMatchInlineSnapshot()
  expect(6 + 6).toMatchInlineSnapshot(`"12"`)
}
