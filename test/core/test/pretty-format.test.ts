import { format } from '@vitest/pretty-format'
import { describe, expect, test } from 'vitest'

describe('maxOutputLength budget', () => {
  // https://github.com/vitest-dev/vitest/issues/9329
  // Object graphs with shared references that fan out can cause exponential
  // output growth, hitting Node's string length limit. The budget (maxOutputLength)
  // guards against this amplification by setting maxDepth = 0 once exceeded.

  // Recursive types show why pretty-format can't terminate:
  // expanding a Child means expanding its Parent, which contains all Children again.
  type Parent = { children: Child[] }
  type Child = { id: number; parent: Parent }

  function createGraph(n: number) {
    //  format(children) --> child(0) --> parent --> child(0)  [Circular]
    //                        |            |
    //                        |            +--> child(1) --> parent  (not ancestor, re-expand!)
    //                        |            |                  +--> child(0) --> parent ...
    //                        |            |                  +--> child(1)  [Circular]
    //                        |            |                  +--> child(2) --> parent ...
    //                        |            +--> child(2) --> parent  (same explosion)
    //                       ...
    //                       child(1) --> parent  (same explosion again from sibling)
    //
    // `parent` is never an ancestor when visiting via a sibling child,
    // so [Circular] doesn't apply and each child fully re-expands it.
    const parent: Parent = { children: [] }
    for (let i = 0; i < n; i++) {
      parent.children.push({ id: i, parent })
    }
    return parent
  }

  test('print graph', () => {
    const parent = createGraph(3)
    expect(format(parent)).toMatchInlineSnapshot(`
      "Object {
        "children": Array [
          Object {
            "id": 0,
            "parent": [Circular],
          },
          Object {
            "id": 1,
            "parent": [Circular],
          },
          Object {
            "id": 2,
            "parent": [Circular],
          },
        ],
      }"
    `)
    expect(format(parent.children)).toMatchInlineSnapshot(`
      "Array [
        Object {
          "id": 0,
          "parent": Object {
            "children": [Circular],
          },
        },
        Object {
          "id": 1,
          "parent": Object {
            "children": [Circular],
          },
        },
        Object {
          "id": 2,
          "parent": Object {
            "children": [Circular],
          },
        },
      ]"
    `)
    // const result = format(parent)
    // expect(result.length).toBeLessThan(100_000)
  })

  // test('custom maxOutputLength limits output', () => {
  //   const children = createGraph(50)
  //   const small = format(children, { maxOutputLength: 5_000 })
  //   const large = format(children, { maxOutputLength: 50_000 })
  //   expect(small.length).toBeLessThan(large.length)
  // })

  // test('abbreviated objects use [ClassName] form after budget exceeded', () => {
  //   const children = createGraph(20)
  //   const result = format(children, { maxOutputLength: 1_000 })
  //   // Once budget trips, remaining objects render as [Object] / [Array]
  //   expect(result).toContain('[Object]')
  // })

  test('early elements expanded, later elements folded after budget trips', () => {
    // Visualizes the kill-switch: once budget is exceeded, maxDepth is set to 0
    // and all subsequent objects render as [ClassName] while earlier ones are full.
    const arr = Array.from({ length: 5 }, (_, i) => ({ id: i, nested: { x: i } }))
    expect(format(arr, { maxOutputLength: 100 })).toMatchInlineSnapshot(`
      "Array [
        Object {
          "id": 0,
          "nested": Object {
            "x": 0,
          },
        },
        Object {
          "id": 1,
          "nested": Object {
            "x": 1,
          },
        },
        [Object],
        [Object],
        [Object],
      ]"
    `)
  })

  test('does not affect simple values', () => {
    // Flat arrays of primitives should format normally — no amplification.
    expect(format([1, 2, 3], { maxOutputLength: 100 })).toMatchInlineSnapshot(`
      "Array [
        1,
        2,
        3,
      ]"
    `)
  })

  test('does not affect normal circular references', () => {
    const obj: any = { a: 1 }
    obj.self = obj
    expect(format(obj, { maxOutputLength: 100 })).toMatchInlineSnapshot(`
      "Object {
        "a": 1,
        "self": [Circular],
      }"
    `)
  })
})
