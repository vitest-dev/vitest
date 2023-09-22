import { describe, expect, test } from 'vitest'

// when snapshots are generated Vitest reruns `toMatchInlineSnapshot` checks
// please, don't commit generated snapshots
describe('snapshots are generated in correct order', async () => {
  test('first snapshot', () => {
    expect({ foo: ['bar'] }).toMatchInlineSnapshot()
  })

  test('second snapshot', () => {
    expect({ foo: ['zed'] }).toMatchInlineSnapshot()
  })
})

describe('snapshots with properties', () => {
  test('without snapshot', () => {
    expect({ foo: 'bar' }).toMatchInlineSnapshot({ foo: expect.any(String) })
  })

  test('with snapshot', () => {
    expect({ first: { second: { foo: 'bar' } } }).toMatchInlineSnapshot({ first: { second: { foo: expect.any(String) } } }, `
      Object {
        "first": Object {
          "wrong": Any<String>,
          "second": null,
        }
      }
    `)
  })

  test('mixed with and without snapshot', () => {
    expect({ first: { second: { foo: 'bar' } } }).toMatchInlineSnapshot({ first: { second: { foo: expect.any(String) } } }, `
      Object {
        "first": Object {
          "wrong": Any<String>,
          "second": null,
        }
      }
    `)

    expect({ first: { second: { foo: 'zed' } } }).toMatchInlineSnapshot(`
      Object {
        "first": Object {
          "second": {
            "foo": "zed"
          }
        }
      }
    `)
  })
})
