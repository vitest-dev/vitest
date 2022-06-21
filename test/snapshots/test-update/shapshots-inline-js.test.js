import { describe, expect, test } from 'vitest'
import { validateNoSnapshots } from './validate-inline-js'

// when snapshots are generated Vitest reruns `toMatchInlineSnapshot` checks
// please, don't commit generated snapshots
describe('snapshots are generated in correct order', async () => {
  await validateNoSnapshots(__filename)

  test('first snaphot', () => {
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
