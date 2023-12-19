import { describe, it } from 'vitest'

describe.concurrent('suite name', () => {
  it('snapshot 1', ({ expect }) => {
    expect({ foo: 'foo' }).toMatchInlineSnapshot()
  })

  it('snapshot 2', ({ expect }) => {
    expect({ foo: 'bar' }).toMatchInlineSnapshot()
  })

  it('snapshot 3', ({ expect }) => {
    expect({ foo: 'qux' }).toMatchInlineSnapshot(`
      Object {
        "foo": "qux",
      }
    `)
  })
})
