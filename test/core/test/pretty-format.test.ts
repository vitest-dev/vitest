import { format } from '@vitest/pretty-format'
import { describe, expect, test } from 'vitest'

describe('maxOutputLength budget', () => {
  // https://github.com/vitest-dev/vitest/issues/9329
  // Object graphs with shared references that fan out can cause exponential
  // output growth, hitting Node's string length limit. The budget (maxOutputLength)
  // guards against this amplification by setting maxDepth = 0 once exceeded.

  function createSharedRefGraph(n: number) {
    // N columns each referencing the same shared model/events objects.
    // When formatting `groups` (not the root model), columnModel is NOT
    // an ancestor — so [Circular] doesn't apply and each column fully
    // re-expands the shared model, causing exponential blowup.
    const model = { columns: [] as any[], groups: [] as any[] }
    const events = { model, listeners: [] }
    for (let i = 0; i < n; i++) {
      const col = { id: `col${i}`, model, events }
      model.columns.push(col)
      if (i % 3 === 0) {
        model.groups.push(col)
      }
    }
    return model
  }

  test('terminates on exponential shared-reference graph', () => {
    const model = createSharedRefGraph(100)
    // Without budget this would hit Node's string length limit.
    // With default budget (100_000) it completes quickly.
    const result = format(model.groups)
    expect(result.length).toBeLessThan(100_000)
  })

  test('custom maxOutputLength limits output', () => {
    const model = createSharedRefGraph(50)
    const small = format(model.groups, { maxOutputLength: 5_000 })
    const large = format(model.groups, { maxOutputLength: 50_000 })
    expect(small.length).toBeLessThan(large.length)
  })

  test('abbreviated objects use [ClassName] form after budget exceeded', () => {
    const model = createSharedRefGraph(20)
    const result = format(model.groups, { maxOutputLength: 1_000 })
    // Once budget trips, remaining objects render as [Object] / [Array]
    expect(result).toContain('[Object]')
  })

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
