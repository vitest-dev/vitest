import { describe, expect, test } from 'vitest'

// when snapshots are generated Vitest reruns `toMatchInlineSnapshot` checks
// please, don't commit generated snapshots
describe('snapshots are generated in correct order', async () => {
  test('first snapshot', () => {
    expect({ foo: ['bar'] }).toMatchInlineSnapshot(`
      Object {
        "foo": Array [
          "bar",
        ],
      }
    `)
  })

  test('second snapshot', () => {
    expect({ foo: ['zed'] }).toMatchInlineSnapshot(`
      Object {
        "foo": Array [
          "zed",
        ],
      }
    `)
  })
})
