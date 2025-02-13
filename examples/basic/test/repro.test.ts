import { expect, test } from 'vitest'

function generate(n: number) {
  const nodes = Array.from({ length: n }, (_, i) => ({ i, next: null as any }))
  nodes.forEach((node, i) => {
    node.next = nodes[(i + 1) % n]
  })
  return nodes
}

test('vitest', () => {
  // get stuck n > 300
  const nodes = generate(1000)
  // diff generation happens after the error is caught by `test` function
  expect(nodes).toEqual([])
  // expect(nodes[0]).toEqual({})

  const nodes2 = generate(1000)
  nodes2[200].i = -1
  expect(nodes[0]).toEqual(nodes2[0])
})

// test('node', () => {
//   // breaks over n > 100
//   const nodes = generate(10);
//   try {
//     // OOMs even with try/catch since node assert generates diff immediately on error
//     assert.deepStrictEqual(nodes, [])
//   } catch (e) {
//     console.log(e)
//   }
// })
