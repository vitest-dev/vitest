import { describe, expect, test } from 'vitest'
import { deepMerge } from '../../../packages/vitest/src/utils'
import { deepMergeSnapshot } from '../../../packages/vitest/src/integrations/snapshot/port/utils'

describe('deepMerge', () => {
  test('non plain objects retain their prototype, arrays are merging, plain objects are merging', () => {
    class Test {
      baz = 'baz'

      get foo() {
        return 'foo'
      }
    }

    const testA = new Test()
    const testB = new Test()

    const a = {
      test: testA,
      num: 30,
      array: [1, 2],
      obj: {
        foo: 'foo',
      },
    }

    const b = {
      test: testB,
      num: 40,
      array: [3, 4],
      obj: {
        baz: 'baz',
      },
    }

    const merged = deepMerge(a, b)

    expect(merged.test instanceof Test).toBe(true)
    expect(merged.num).toBe(40)
    expect(merged.array).toEqual([1, 2, 3, 4])
    expect(merged.obj).toEqual({
      foo: 'foo',
      baz: 'baz',
    })
  })

  test('deepMergeSnapshot considers asymmetric matcher', () => {
    class Test {
      zoo = 'zoo'
      get bar() {
        return 'name'
      }
    }

    const obj = deepMergeSnapshot({
      regexp: /test/,
      test: new Test(),
      name: 'name',
      foo: 5,
      array: [/test/, 'test'],
    }, {
      name: expect.stringContaining('name'),
      foo: 88,
      array: [/test2/],
      test: { baz: 'baz' },
    })

    expect(obj.regexp instanceof RegExp).toBe(true)
    expect(obj.test instanceof Test).toBe(false)
    expect(obj.array[0] instanceof RegExp).toBe(false)

    expect(obj).toEqual({
      regexp: /test/,
      test: { baz: 'baz', zoo: 'zoo' },
      name: expect.stringContaining('name'),
      foo: 88,
      array: [{}, 'test'],
    })
  })
})
