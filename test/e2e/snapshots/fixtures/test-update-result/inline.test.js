import { describe, expect, test } from 'vitest'

// when snapshots are generated Vitest reruns `toMatchInlineSnapshot` checks
// please, don't commit generated snapshots
describe('snapshots are generated in correct order', async () => {
  test('first snapshot', () => {
    expect({ foo: ['bar'] }).toMatchInlineSnapshot(`
      {
        "foo": [
          "bar",
        ],
      }
    `)
  })

  test('second snapshot', () => {
    expect({ foo: ['zed'] }).toMatchInlineSnapshot(`
      {
        "foo": [
          "zed",
        ],
      }
    `)
  })
})

describe('snapshots with properties', () => {
  test('without snapshot', () => {
    expect({ foo: 'bar' }).toMatchInlineSnapshot({ foo: expect.any(String) }, `
      {
        "foo": Any<String>,
      }
    `)
  })

  test('with snapshot', () => {
    expect({ first: { second: { foo: 'bar' } } }).toMatchInlineSnapshot({ first: { second: { foo: expect.any(String) } } }, `
      {
        "first": {
          "second": {
            "foo": Any<String>,
          },
        },
      }
    `)
  })

  test('mixed with and without snapshot', () => {
    expect({ first: { second: { foo: 'bar' } } }).toMatchInlineSnapshot({ first: { second: { foo: expect.any(String) } } }, `
      {
        "first": {
          "second": {
            "foo": Any<String>,
          },
        },
      }
    `)

    expect({ first: { second: { foo: 'zed' } } }).toMatchInlineSnapshot(`
      {
        "first": {
          "second": {
            "foo": "zed",
          },
        },
      }
    `)
  })
})
