import { expect, test, vi } from 'vitest'
import { stringify } from '@vitest/utils'
import { displayDiff } from 'vitest/src/node/error'

test('displays an error for large objects', () => {
  const objectA = new Array(1000).fill(0).map((_, i) => ({ i, long: 'a'.repeat(i) }))
  const objectB = new Array(1000).fill(0).map((_, i) => ({ i, long: 'b'.repeat(i) }))
  const console = { log: vi.fn(), error: vi.fn() }
  displayDiff(stringify(objectA), stringify(objectB), console as any)
  expect(console.error.mock.calls[0][0]).toMatchInlineSnapshot(`
    "Could not display diff. It's possible objects are too large to compare.
    Try increasing --outputDiffMaxSize option.
    "
  `)
})

test('displays an error for large objects', () => {
  const console = { log: vi.fn(), error: vi.fn() }
  displayDiff(stringify('undefined'), stringify('undefined'), console as any)
  expect(console.error).not.toHaveBeenCalled()
})

test('displays diff', () => {
  const objectA = { a: 1, b: 2 }
  const objectB = { a: 1, b: 3 }
  const console = { log: vi.fn(), error: vi.fn() }
  displayDiff(stringify(objectA), stringify(objectB), console as any)
  expect(console.error.mock.calls[0][0]).toMatchInlineSnapshot(`
    "  - Expected  - 1
      + Received  + 1

        Object {
          \\"a\\": 1,
      -   \\"b\\": 3,
      +   \\"b\\": 2,
        }
    "
  `)
})

test('displays long diff', () => {
  const objectA = { a: 1, b: 2, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9, j: 10, k: 11, l: 12, m: 13, n: 14, o: 15, p: 16, q: 17, r: 18, s: 19, t: 20, u: 21, v: 22, w: 23, x: 24, y: 25, z: 26 }
  const objectB = { a: 1, b: 3, k: 11, l: 12, m: 13, n: 14, p: 16, o: 17, r: 18, s: 23, t: 88, u: 21, v: 44, w: 23, x: 24, y: 25, z: 26 }
  const console = { log: vi.fn(), error: vi.fn() }
  displayDiff(stringify(objectA), stringify(objectB), console as any, { outputDiffMaxLines: 5 })
  expect(console.error.mock.calls[0][0]).toMatchInlineSnapshot(`
    "  - Expected  - 5
      + Received  + 13

        Object {
          \\"a\\": 1,
      -   \\"b\\": 3,
      +   \\"b\\": 2,
      +   \\"d\\": 4,
      ... 26 more lines
    "
  `)
})

test('displays truncated diff', () => {
  const stringA = `Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Suspendisse viverra sapien ac venenatis lacinia.
Morbi consectetur arcu nec lorem lacinia tempus.`
  const objectB = `Quisque hendrerit metus id dapibus pulvinar.
Quisque pellentesque enim a elit faucibus cursus.
Sed in tellus aliquet mauris interdum semper a in lacus.`
  const console = { log: vi.fn(), error: vi.fn() }
  displayDiff((stringA), (objectB), console as any, { outputTruncateLength: 14 })
  expect(console.error.mock.calls[0][0]).toMatchInlineSnapshot(`
    "  - Expected  - 3
      + Received  + 3

      - Quisque h…
      - Quisque p…
      - Sed in te…
      + Lorem ips…
      + Suspendis…
      + Morbi con…
    "
  `)
})
