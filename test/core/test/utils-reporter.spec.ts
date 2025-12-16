import { describe, expect, test } from 'vitest'
import { compactJsonParse, compactJsonStringify } from '../../../packages/vitest/src/node/reporters/blob'

describe('compactJsonStringify and compactJsonParse', () => {
  test('basic', () => {
    const obj = {
      str: 'hello',
      num: 42,
      float: 3.14,
      bool: true,
      nil: null,
      und: undefined,
      arr: [1, 2, 3],
      nested: { bar: 'baz' },
    }
    const str = compactJsonStringify(obj)
    expect(str).toMatchInlineSnapshot(`
      "["str","num","float","bool","nil","arr","nested","hello","bar","baz"]
      ["!o",0,["!s",7],1,42,2,3.14,3,true,4,null,5,[1,2,3],6,["!o",8,["!s",9]]]"
    `)
    const restored = compactJsonParse(str)
    expect(restored).toEqual(obj)
  })

  test('string interning', () => {
    const obj = {
      file1: { module: 'shared' },
      file2: { module: 'shared' },
    }
    const str = compactJsonStringify(obj)
    // "module" and "shared" appear once in string table despite being used twice
    expect(str).toMatchInlineSnapshot(`
      "["file1","file2","module","shared"]
      ["!o",0,["!o",2,["!s",3]],1,["!o",2,["!s",3]]]"
    `)
    const restored = compactJsonParse(str)
    expect(restored).toEqual(obj)
  })

  test('escape collision - array starting with "!"', () => {
    const obj = { data: ['!s', 5] }
    const str = compactJsonStringify(obj)
    expect(str).toMatchInlineSnapshot(`
      "["data"]
      ["!o",0,["!","!s",5]]"
    `)
    const restored = compactJsonParse(str)
    expect(restored).toEqual(obj)
  })

  test.for([
    { name: 'escape collision - !o', obj: { data: ['!o', 'something'] } },
    { name: 'escape collision - nested', obj: { data: ['!', '!s', 5] } },
    { name: 'strings starting with !', obj: { key: '!important', another: '!value' } },
    { name: 'empty object', obj: {} },
    { name: 'empty array', obj: { arr: [] } },
    {
      name: 'deeply nested',
      obj: {
        level1: {
          level2: {
            level3: {
              level4: { value: 'deep' },
            },
          },
        },
      },
    },
    {
      name: 'mixed arrays and objects',
      obj: {
        users: [
          { name: 'alice', tags: ['admin', 'user'] },
          { name: 'bob', tags: ['user'] },
        ],
      },
    },
  ])('roundtrip - $name', ({ obj }) => {
    const str = compactJsonStringify(obj)
    const restored = compactJsonParse(str)
    expect(restored).toEqual(obj)
  })
})
