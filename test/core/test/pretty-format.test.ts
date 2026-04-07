import { inspect as nodeInspect } from 'node:util'
import { format, plugins } from '@vitest/pretty-format'
import { inspect as prettyInspect } from '@vitest/utils/display'
import { inspect as loupeInspect } from 'loupe'
import { describe, expect, test } from 'vitest'

describe('maxOutputLength', () => {
  function createObjectGraph(n: number) {
    // owner
    //  |-> cats
    //       |-> cat0 -> owner
    //       |-> cat1 -> owner
    //       |-> cat2
    //       |-> ...
    //  |-> dogs
    //       |-> dog0
    //       |-> dog1
    //       |-> dog2
    //       |-> ...
    interface Owner {
      dogs: Pet[]
      cats: Pet[]
    }
    interface Pet {
      name: string
      owner: Owner
    }
    const owner: Owner = { dogs: [], cats: [] }
    for (let i = 0; i < n; i++) {
      owner.dogs.push({ name: `dog${i}`, owner })
    }
    for (let i = 0; i < n; i++) {
      owner.cats.push({ name: `cat${i}`, owner })
    }
    return owner
  }

  test('quadratic growth example depending on format root', () => {
    const owner = createObjectGraph(3)

    // when starting from owner, each pet is expanded once, so no amplification, just linear growth.
    expect(format(owner)).toMatchInlineSnapshot(`
      "Object {
        "cats": Array [
          Object {
            "name": "cat0",
            "owner": [Circular],
          },
          Object {
            "name": "cat1",
            "owner": [Circular],
          },
          Object {
            "name": "cat2",
            "owner": [Circular],
          },
        ],
        "dogs": Array [
          Object {
            "name": "dog0",
            "owner": [Circular],
          },
          Object {
            "name": "dog1",
            "owner": [Circular],
          },
          Object {
            "name": "dog2",
            "owner": [Circular],
          },
        ],
      }"
    `)

    // when starting from owner.cats, each cat re-expands the full dogs list via owner.
    // this exhibits quadratic growth, which is what the budget is designed to prevent.
    expect(format(owner.cats)).toMatchInlineSnapshot(`
      "Array [
        Object {
          "name": "cat0",
          "owner": Object {
            "cats": [Circular],
            "dogs": Array [
              Object {
                "name": "dog0",
                "owner": [Circular],
              },
              Object {
                "name": "dog1",
                "owner": [Circular],
              },
              Object {
                "name": "dog2",
                "owner": [Circular],
              },
            ],
          },
        },
        Object {
          "name": "cat1",
          "owner": Object {
            "cats": [Circular],
            "dogs": Array [
              Object {
                "name": "dog0",
                "owner": [Circular],
              },
              Object {
                "name": "dog1",
                "owner": [Circular],
              },
              Object {
                "name": "dog2",
                "owner": [Circular],
              },
            ],
          },
        },
        Object {
          "name": "cat2",
          "owner": Object {
            "cats": [Circular],
            "dogs": Array [
              Object {
                "name": "dog0",
                "owner": [Circular],
              },
              Object {
                "name": "dog1",
                "owner": [Circular],
              },
              Object {
                "name": "dog2",
                "owner": [Circular],
              },
            ],
          },
        },
      ]"
    `)
  })

  test('budget prevents blowup on large graphs', () => {
    // quickly hit the kill switch due to quadratic growth
    expect([10, 20, 30, 1000, 2000, 3000].map(n => format(createObjectGraph(n).cats).length))
      .toMatchInlineSnapshot(`
        [
          9729,
          36659,
          80789,
          1056011,
          1074009,
          1088009,
        ]
      `)

    // depending on object/array shape, output can exceed the limit 1mb
    // but the output size is proportional to the amount of objects and the size of array.
    expect(format(createObjectGraph(10000).cats).length).toMatchInlineSnapshot(`1377439`)
    expect(format(createObjectGraph(20000).cats).length).toMatchInlineSnapshot(`1497738`)
  })

  test('budget should not truncate output shorter than maxOutputLength', () => {
    const data = Array.from({ length: 50 }, (_, i) => ({ a: { b: { c: i } } }))
    const full = format(data, { maxOutputLength: Infinity })
    const limited = format(data, { maxOutputLength: full.length })
    // this invariant should hold for any input
    expect(limited.length).toBe(full.length)
    expect({ limited: limited.length, full: full.length }).toMatchInlineSnapshot(`
      {
        "full": 4349,
        "limited": 4349,
      }
    `)
  })

  test('early elements expanded, later elements folded after budget trips', () => {
    // First few objects are fully expanded, but once budget is exceeded,
    // maxDepth = 0 means no more expansion.
    const arr = Array.from({ length: 10 }, (_, i) => ({ i }))
    expect(format(arr, { maxOutputLength: 100 })).toMatchInlineSnapshot(`
      "Array [
        Object {
          "i": 0,
        },
        Object {
          "i": 1,
        },
        Object {
          "i": 2,
        },
        Object {
          "i": 3,
        },
        Object {
          "i": 4,
        },
        [Object],
        [Object],
        [Object],
        [Object],
        [Object],
      ]"
    `)
  })
})

describe('basic types', () => {
  test('null', () => {
    expect(format(null)).toMatchInlineSnapshot(`"null"`)
  })

  test('undefined', () => {
    expect(format(undefined)).toMatchInlineSnapshot(`"undefined"`)
  })

  test('true', () => {
    expect(format(true)).toMatchInlineSnapshot(`"true"`)
  })

  test('false', () => {
    expect(format(false)).toMatchInlineSnapshot(`"false"`)
  })

  test('positive number', () => {
    expect(format(123)).toMatchInlineSnapshot(`"123"`)
  })

  test('negative number', () => {
    expect(format(-123)).toMatchInlineSnapshot(`"-123"`)
  })

  test('zero', () => {
    expect(format(0)).toMatchInlineSnapshot(`"0"`)
  })

  test('negative zero', () => {
    expect(format(-0)).toMatchInlineSnapshot(`"-0"`)
  })

  test('NaN', () => {
    expect(format(Number.NaN)).toMatchInlineSnapshot(`"NaN"`)
  })

  test('Infinity', () => {
    expect(format(Number.POSITIVE_INFINITY)).toMatchInlineSnapshot(`"Infinity"`)
  })

  test('-Infinity', () => {
    expect(format(Number.NEGATIVE_INFINITY)).toMatchInlineSnapshot(`"-Infinity"`)
  })

  test('float', () => {
    expect(format(3.14)).toMatchInlineSnapshot(`"3.14"`)
  })

  test('positive bigint', () => {
    expect(format(123n)).toMatchInlineSnapshot(`"123n"`)
  })

  test('negative bigint', () => {
    expect(format(-123n)).toMatchInlineSnapshot(`"-123n"`)
  })

  test('zero bigint', () => {
    expect(format(0n)).toMatchInlineSnapshot(`"0n"`)
  })

  test('string', () => {
    expect(format('string')).toMatchInlineSnapshot(`""string""`)
  })

  test('empty string', () => {
    expect(format('')).toMatchInlineSnapshot(`""""`)
  })

  test('string with double quotes and backslash (escapeString default)', () => {
    expect(format('"\'\\'))
      .toMatchInlineSnapshot(`""\\"'\\\\""`)
  })

  test('multiline string', () => {
    expect(format('line 1\nline 2')).toMatchInlineSnapshot(`
      ""line 1
      line 2""
    `)
  })

  test('named symbol', () => {
    expect(format(Symbol('test'))).toMatchInlineSnapshot(`"Symbol(test)"`)
  })

  test('unnamed symbol', () => {
    expect(format(Symbol(''))).toMatchInlineSnapshot(`"Symbol()"`)
  })

  test('named function', () => {
    function named() {}
    expect(format(named)).toMatchInlineSnapshot(`"[Function named]"`)
  })

  test('anonymous function', () => {
    expect(format(() => {})).toMatchInlineSnapshot(`"[Function anonymous]"`)
  })

  test('named generator function', () => {
    function* gen() {
      yield 1
    }
    expect(format(gen)).toMatchInlineSnapshot(`"[Function gen]"`)
  })

  test('date', () => {
    expect(format(new Date(10e11))).toMatchInlineSnapshot(`"2001-09-09T01:46:40.000Z"`)
  })

  test('invalid date', () => {
    expect(format(new Date(Infinity))).toMatchInlineSnapshot(`"Date { NaN }"`)
  })

  test('regexp from literal', () => {
    expect(format(/regexp/gi)).toMatchInlineSnapshot(`"/regexp/gi"`)
  })

  test('regexp from constructor', () => {
    expect(format(/regexp/)).toMatchInlineSnapshot(`"/regexp/"`)
  })

  test('error', () => {
    expect(format(new Error('test'))).toMatchInlineSnapshot(`"[Error: test]"`)
  })

  test('typed error with message', () => {
    expect(format(new TypeError('message'))).toMatchInlineSnapshot(`"[TypeError: message]"`)
  })

  test('WeakMap', () => {
    expect(format(new WeakMap())).toMatchInlineSnapshot(`"WeakMap {}"`)
  })

  test('WeakSet', () => {
    expect(format(new WeakSet())).toMatchInlineSnapshot(`"WeakSet {}"`)
  })

  test('Promise', () => {
    expect(format(Promise.resolve())).toMatchInlineSnapshot(`"Promise {}"`)
  })
})

// -- collections --

describe('arrays', () => {
  test('empty', () => {
    expect(format([])).toMatchInlineSnapshot(`"Array []"`)
  })

  test('with items', () => {
    expect(format([1, 2, 3])).toMatchInlineSnapshot(`
      "Array [
        1,
        2,
        3,
      ]"
    `)
  })

  test('sparse with only holes', () => {
    // eslint-disable-next-line no-sparse-arrays
    expect(format([, , ,])).toMatchInlineSnapshot(`
      "Array [
        ,
        ,
        ,
      ]"
    `)
  })

  test('sparse with items', () => {
    // eslint-disable-next-line no-sparse-arrays
    expect(format([1, , , 4])).toMatchInlineSnapshot(`
      "Array [
        1,
        ,
        ,
        4,
      ]"
    `)
  })

  test('sparse with undefined', () => {
    // eslint-disable-next-line no-sparse-arrays
    expect(format([1, , undefined, , 4])).toMatchInlineSnapshot(
      `
      "Array [
        1,
        ,
        undefined,
        ,
        4,
      ]"
    `,
    )
  })

  test('nested', () => {
    expect(format([[1, 2]])).toMatchInlineSnapshot(
      `
      "Array [
        Array [
          1,
          2,
        ],
      ]"
    `,
    )
  })

  test('typed array empty', () => {
    expect(format(new Uint8Array(0))).toMatchInlineSnapshot(`"Uint8Array []"`)
  })

  test('typed array with items', () => {
    expect(format(new Uint32Array(3))).toMatchInlineSnapshot(
      `
      "Uint32Array [
        0,
        0,
        0,
      ]"
    `,
    )
  })

  test('ArrayBuffer', () => {
    expect(format(new ArrayBuffer(3))).toMatchInlineSnapshot(
      `
      "ArrayBuffer [
        0,
        0,
        0,
      ]"
    `,
    )
  })

  test('DataView', () => {
    expect(format(new DataView(new ArrayBuffer(3)))).toMatchInlineSnapshot(
      `
      "DataView [
        0,
        0,
        0,
      ]"
    `,
    )
  })
})

describe('objects', () => {
  test('empty', () => {
    expect(format({})).toMatchInlineSnapshot(`"Object {}"`)
  })

  test('with properties', () => {
    expect(format({ prop1: 'value1', prop2: 'value2' })).toMatchInlineSnapshot(
      `
      "Object {
        "prop1": "value1",
        "prop2": "value2",
      }"
    `,
    )
  })

  test('keys are sorted by default', () => {
    expect(format({ b: 1, a: 2 })).toMatchInlineSnapshot(
      `
      "Object {
        "a": 2,
        "b": 1,
      }"
    `,
    )
  })

  test('deeply nested', () => {
    expect(format({ a: { b: { c: 'val' } } })).toMatchInlineSnapshot(
      `
      "Object {
        "a": Object {
          "b": Object {
            "c": "val",
          },
        },
      }"
    `,
    )
  })

  test('Object.create(null)', () => {
    expect(format(Object.create(null))).toMatchInlineSnapshot(`"Object {}"`)
  })

  test('custom constructor name', () => {
    class Foo { x = 1 }
    expect(format(new Foo())).toMatchInlineSnapshot(`
      "Foo {
        "x": 1,
      }"
    `)
  })

  test('with symbol properties', () => {
    const val: any = { prop: 'value' }
    val[Symbol('sym')] = 'symval'
    expect(format(val)).toMatchInlineSnapshot(
      `
      "Object {
        "prop": "value",
        Symbol(sym): "symval",
      }"
    `,
    )
  })

  test('skips non-enumerable string keys', () => {
    const val = { enumerable: true }
    Object.defineProperty(val, 'hidden', { enumerable: false, value: false })
    expect(format(val)).toMatchInlineSnapshot(`
      "Object {
        "enumerable": true,
      }"
    `)
  })

  test('skips non-enumerable symbol keys', () => {
    const val = { enumerable: true }
    Object.defineProperty(val, Symbol('hidden'), { enumerable: false, value: false })
    expect(format(val)).toMatchInlineSnapshot(`
      "Object {
        "enumerable": true,
      }"
    `)
  })

  test('circular reference', () => {
    const val: any = {}
    val.self = val
    expect(format(val)).toMatchInlineSnapshot(`
      "Object {
        "self": [Circular],
      }"
    `)
  })

  test('parallel references', () => {
    const inner = {}
    expect(format({ a: inner, b: inner })).toMatchInlineSnapshot(
      `
      "Object {
        "a": Object {},
        "b": Object {},
      }"
    `,
    )
  })
})

describe('Map', () => {
  test('empty', () => {
    expect(format(new Map())).toMatchInlineSnapshot(`"Map {}"`)
  })

  test('with string keys', () => {
    const val = new Map([['a', 1], ['b', 2]])
    expect(format(val)).toMatchInlineSnapshot(
      `
      "Map {
        "a" => 1,
        "b" => 2,
      }"
    `,
    )
  })

  test('with non-string keys', () => {
    const val = new Map<unknown, unknown>([
      [false, 'bool'],
      [null, 'null'],
      [undefined, 'undef'],
      [42, 'num'],
    ])
    expect(format(val)).toMatchInlineSnapshot(
      `
      "Map {
        false => "bool",
        null => "null",
        undefined => "undef",
        42 => "num",
      }"
    `,
    )
  })
})

describe('Set', () => {
  test('empty', () => {
    expect(format(new Set())).toMatchInlineSnapshot(`"Set {}"`)
  })

  test('with values', () => {
    expect(format(new Set(['a', 'b']))).toMatchInlineSnapshot(
      `
      "Set {
        "a",
        "b",
      }"
    `,
    )
  })
})

describe('Arguments', () => {
  function returnArguments(..._args: Array<unknown>) {
    // eslint-disable-next-line prefer-rest-params
    return arguments
  }

  test('empty', () => {
    expect(format(returnArguments())).toMatchInlineSnapshot(`"Arguments []"`)
  })

  test('with values', () => {
    expect(format(returnArguments(1, 2, 3))).toMatchInlineSnapshot(
      `
      "Arguments [
        1,
        2,
        3,
      ]"
    `,
    )
  })
})

describe('indent option', () => {
  const val = [{ a: 1 }]

  test('default (2 spaces)', () => {
    expect(format(val)).toMatchInlineSnapshot(
      `
      "Array [
        Object {
          "a": 1,
        },
      ]"
    `,
    )
  })

  test('0 spaces', () => {
    expect(format(val, { indent: 0 })).toMatchInlineSnapshot(
      `
      "Array [
      Object {
      "a": 1,
      },
      ]"
    `,
    )
  })

  test('4 spaces', () => {
    expect(format(val, { indent: 4 })).toMatchInlineSnapshot(
      `
      "Array [
          Object {
              "a": 1,
          },
      ]"
    `,
    )
  })
})

describe('maxDepth option', () => {
  test('truncates nested structures', () => {
    const val = { a: { b: { c: 'deep' } }, arr: [[1]] }
    expect(format(val, { maxDepth: 1 })).toMatchInlineSnapshot(
      `
      "Object {
        "a": [Object],
        "arr": [Array],
      }"
    `,
    )
  })

  test('maxDepth with Map and Set', () => {
    const val = { m: new Map([['k', 'v']]), s: new Set([1]) }
    expect(format(val, { maxDepth: 1 })).toMatchInlineSnapshot(
      `
      "Object {
        "m": [Map],
        "s": [Set],
      }"
    `,
    )
  })
})

describe('maxWidth option', () => {
  test('object', () => {
    const input = { one: 1, two: 2, three: 3, four: 4, five: 5 }
    expect(format(input, { maxWidth: 3, compareKeys: null })).toMatchInlineSnapshot(`
      "Object {
        "one": 1,
        "two": 2,
        "three": 3,
        …
      }"
    `)
  })

  test('truncates arrays', () => {
    expect(format([1, 2, 3, 4, 5], { maxWidth: 3 })).toMatchInlineSnapshot(
      `
      "Array [
        1,
        2,
        3,
        …
      ]"
    `,
    )
  })

  test('truncates sets', () => {
    expect(format(new Set([1, 2, 3, 4, 5]), { maxWidth: 3 })).toMatchInlineSnapshot(
      `
      "Set {
        1,
        2,
        3,
        …
      }"
    `,
    )
  })

  test('truncates maps', () => {
    const val = new Map([['a', 1], ['b', 2], ['c', 3], ['d', 4]])
    expect(format(val, { maxWidth: 2 })).toMatchInlineSnapshot(
      `
      "Map {
        "a" => 1,
        "b" => 2,
        …
      }"
    `,
    )
  })
})

describe('min option', () => {
  test('basic values', () => {
    expect(format({ a: [1, 2], b: 'str' }, { min: true })).toMatchInlineSnapshot(
      `"{"a": [1, 2], "b": "str"}"`,
    )
  })

  test('Map and Set', () => {
    expect(format(new Map([['k', 'v']]), { min: true })).toMatchInlineSnapshot(
      `"Map {"k" => "v"}"`,
    )
    expect(format(new Set([1, 2]), { min: true })).toMatchInlineSnapshot(
      `"Set {1, 2}"`,
    )
  })

  test('does not allow indent !== 0 with min', () => {
    expect(() => format(1, { indent: 1, min: true }))
      .toThrowErrorMatchingInlineSnapshot(`[Error: pretty-format: Options "min" and "indent" cannot be used together.]`)
  })
})

describe('compareKeys option', () => {
  test('null preserves insertion order', () => {
    expect(format({ b: 1, a: 2 })).toMatchInlineSnapshot(
      `
      "Object {
        "a": 2,
        "b": 1,
      }"
    `,
    )
    expect(format({ b: 1, a: 2 }, { compareKeys: null })).toMatchInlineSnapshot(
      `
      "Object {
        "b": 1,
        "a": 2,
      }"
    `,
    )
  })

  test('custom sort (reverse)', () => {
    const compareKeys = (a: string, b: string) => (a > b ? -1 : 1)
    expect(format({ a: 1, b: 2 }, { compareKeys })).toMatchInlineSnapshot(
      `
      "Object {
        "b": 2,
        "a": 1,
      }"
    `,
    )
  })
})

describe('callToJSON option', () => {
  test('calls toJSON by default', () => {
    const val = { toJSON: () => ({ replaced: true }), orig: 1 }
    expect(format(val)).toMatchInlineSnapshot(
      `
      "Object {
        "replaced": true,
      }"
    `,
    )
  })

  test('skips toJSON when false', () => {
    const val = { toJSON: () => 'ignored', orig: 1 }
    const result = format(val, { callToJSON: false })
    expect(result).toMatchInlineSnapshot(`
      "Object {
        "orig": 1,
        "toJSON": [Function toJSON],
      }"
    `)
  })

  test('does not call toJSON recursively', () => {
    const val = { toJSON: () => ({ toJSON: () => 'deep' }) }
    expect(format(val)).toMatchInlineSnapshot(
      `
      "Object {
        "toJSON": [Function toJSON],
      }"
    `,
    )
  })
})

describe('printBasicPrototype option', () => {
  test('includes prototype name by default', () => {
    expect(format({})).toMatchInlineSnapshot(`"Object {}"`)
    expect(format([])).toMatchInlineSnapshot(`"Array []"`)
  })

  test('omits basic prototype names when false', () => {
    expect(format({}, { printBasicPrototype: false })).toMatchInlineSnapshot(`"{}"`)
    expect(format([], { printBasicPrototype: false })).toMatchInlineSnapshot(`"[]"`)
  })

  test('still shows custom constructor names when false', () => {
    class Custom {}
    expect(format(new Custom(), { printBasicPrototype: false })).toMatchInlineSnapshot(`"Custom {}"`)
  })
})

describe('printFunctionName option', () => {
  test('prints function name by default', () => {
    function myFn() {}
    expect(format(myFn)).toMatchInlineSnapshot(`"[Function myFn]"`)
  })

  test('hides function name when false', () => {
    function myFn() {}
    expect(format(myFn, { printFunctionName: false })).toMatchInlineSnapshot(`"[Function]"`)
  })
})

describe('escapeString option', () => {
  test('escapes by default', () => {
    expect(format('"hello"')).toMatchInlineSnapshot(`""\\"hello\\"""`)
  })

  test('does not escape when false', () => {
    expect(format('"hello"', { escapeString: false })).toMatchInlineSnapshot(`"""hello"""`)
  })
})

describe('escapeRegex option', () => {
  test('no escaping by default', () => {
    expect(format(/regexp\d/gi)).toMatchInlineSnapshot(`"/regexp\\d/gi"`)
  })

  test('escapes when true', () => {
    expect(format(/regexp\d/gi, { escapeRegex: true })).toMatchInlineSnapshot(`"/regexp\\\\d/gi"`)
  })
})

describe('singleQuote option', () => {
  test('uses double quotes by default', () => {
    expect(format('hello')).toMatchInlineSnapshot(`""hello""`)
  })

  test('uses single quotes when true', () => {
    expect(format('hello', { singleQuote: true })).toMatchInlineSnapshot(`"'hello'"`)
  })

  test('escapes single quotes inside string when singleQuote + escapeString', () => {
    expect(format('it\'s', { singleQuote: true })).toMatchInlineSnapshot(`"'it\\'s'"`)
  })

  test('escapes backslash when singleQuote + escapeString', () => {
    expect(format('a\\b', { singleQuote: true })).toMatchInlineSnapshot(`"'a\\\\b'"`)
  })

  test('does not escape double quotes when singleQuote', () => {
    expect(format('say "hi"', { singleQuote: true })).toMatchInlineSnapshot(`"'say "hi"'"`)
  })

  test('applies to object values', () => {
    expect(format({ a: 'b' }, { singleQuote: true, min: true })).toMatchInlineSnapshot(
      `"{'a': 'b'}"`,
    )
  })

  test('applies to Map keys and values', () => {
    expect(format(new Map([['k', 'v']]), { singleQuote: true, min: true })).toMatchInlineSnapshot(
      `"Map {'k' => 'v'}"`,
    )
  })
})

describe('quoteKeys option', () => {
  test('quotes all keys by default', () => {
    expect(format({ a: 1 }, { min: true })).toMatchInlineSnapshot(`"{"a": 1}"`)
  })

  test('does not quote valid identifiers when false', () => {
    expect(format({ a: 1, foo_bar: 2, $x: 3 }, { quoteKeys: false, min: true })).toMatchInlineSnapshot(
      `"{$x: 3, a: 1, foo_bar: 2}"`,
    )
  })

  test('still quotes non-identifier keys when false', () => {
    expect(format({ 'has space': 1 }, { quoteKeys: false, min: true })).toMatchInlineSnapshot(
      `"{"has space": 1}"`,
    )
  })

  test('still quotes keys starting with digit when false', () => {
    expect(format({ '0abc': 1 }, { quoteKeys: false, min: true })).toMatchInlineSnapshot(
      `"{"0abc": 1}"`,
    )
  })

  test('still quotes empty key when false', () => {
    expect(format({ '': 1 }, { quoteKeys: false, min: true })).toMatchInlineSnapshot(
      `"{"": 1}"`,
    )
  })

  test('still quotes key with dash when false', () => {
    expect(format({ 'my-key': 1 }, { quoteKeys: false, min: true })).toMatchInlineSnapshot(
      `"{"my-key": 1}"`,
    )
  })
})

describe('spacingInner / spacingOuter options', () => {
  test('min: true defaults', () => {
    // min: true → spacingInner: ' ', spacingOuter: ''
    expect(format({ a: 1, b: 2 }, { min: true })).toMatchInlineSnapshot(`"{"a": 1, "b": 2}"`)
  })

  test('spacingOuter override with min: true', () => {
    // override spacingOuter to add space around braces (loupe-like)
    expect(format({ a: 1 }, { min: true, spacingOuter: ' ' })).toMatchInlineSnapshot(`"{ "a": 1 }"`)
  })

  test('spacingInner override', () => {
    // min: true still places comma before spacingInner
    expect(format([1, 2], { min: true, spacingInner: ' | ' })).toMatchInlineSnapshot(`"[1, | 2]"`)
  })
})

describe('ErrorPlugin', () => {
  test('Error with message', () => {
    const err = new Error('boom')
    expect(format(err, { plugins: [plugins.Error] })).toMatchInlineSnapshot(`
      "Error {
        "message": "boom",
      }"
    `)
  })

  test('TypeError', () => {
    const err = new TypeError('bad type')
    expect(format(err, { plugins: [plugins.Error] })).toMatchInlineSnapshot(`
      "TypeError {
        "message": "bad type",
      }"
    `)
  })

  test('Error with cause', () => {
    const err = new Error('outer', { cause: 'inner' })
    expect(format(err, { plugins: [plugins.Error] })).toMatchInlineSnapshot(`
      "Error {
        "message": "outer",
        "cause": "inner",
      }"
    `)
  })

  test('AggregateError', () => {
    const err = new AggregateError([new Error('a'), new Error('b')], 'multiple')
    const result = format(err, { plugins: [plugins.Error] })
    expect(result).toMatchInlineSnapshot(`
      "AggregateError {
        "message": "multiple",
        "errors": Array [
          Error {
            "message": "a",
          },
          Error {
            "message": "b",
          },
        ],
      }"
    `)
  })

  test('circular error', () => {
    const err = new Error('loop') as any
    err.self = err
    const result = format(err, { plugins: [plugins.Error] })
    expect(result).toMatchInlineSnapshot(`
      "Error {
        "message": "loop",
        "self": [Circular],
      }"
    `)
  })
})

describe('plugins', () => {
  test('custom plugin with test/print', () => {
    class Foo { value = 42 }
    const result = format(new Foo(), {
      plugins: [{
        test: (val: unknown) => val instanceof Foo,
        print: (val: any) => `Foo(${val.value})`,
      }],
    })
    expect(result).toMatchInlineSnapshot(`"Foo(42)"`)
  })

  test('custom plugin with test/serialize', () => {
    class Bar {}
    const result = format(new Bar(), {
      plugins: [{
        test: (val: unknown) => val instanceof Bar,
        serialize: () => 'serialized Bar',
      }],
    })
    expect(result).toMatchInlineSnapshot(`"serialized Bar"`)
  })

  test('plugin returning empty string', () => {
    const result = format('x', {
      plugins: [{
        test: () => true,
        print: () => '',
      }],
    })
    expect(result).toMatchInlineSnapshot(`""`)
  })

  test('throws if plugin returns non-string', () => {
    expect(() => format(1, {
      plugins: [{
        test: () => true,
        // @ts-expect-error testing runtime
        print: (val: unknown) => val,
      }],
    })).toThrowErrorMatchingInlineSnapshot(`[TypeError: pretty-format: Plugin must return type "string" but instead returned "number".]`)
  })
})

describe('validation', () => {
  test('throws on unknown option', () => {
    expect(() => {
      // @ts-expect-error testing runtime
      format({}, { badOption: true })
    }).toThrowErrorMatchingInlineSnapshot(`[Error: pretty-format: Unknown option "badOption".]`)
  })
})

// -- prettyInspect --

describe('prettyInspect', () => {
  test('no truncation by default (truncate: 0)', () => {
    const long = 'a'.repeat(200)
    expect(prettyInspect(long)).toBe(`'${long}'`)
    expect(prettyInspect(long, { truncate: 0 })).toBe(`'${long}'`)
  })

  test('no truncation when value fits within threshold', () => {
    expect(prettyInspect('short', { truncate: 100 })).toMatchInlineSnapshot(`"'short'"`)
  })

  test('truncates string', () => {
    const long = '0123456789012345678901234567890123456789'
    expect(prettyInspect(long, { truncate: 20 })).toMatchInlineSnapshot(`"'012345678901234567…'"`)
  })

  test('truncates surragete pair correctly', () => {
    expect(prettyInspect('😀'.repeat(5), { truncate: 14 })).toMatchInlineSnapshot(`"'😀😀😀😀😀'"`)
    expect(prettyInspect('😀'.repeat(6), { truncate: 14 })).toMatchInlineSnapshot(`"'😀😀😀😀😀😀'"`)
    expect(prettyInspect('😀'.repeat(7), { truncate: 14 })).toMatchInlineSnapshot(`"'😀😀😀😀😀😀…'"`)
    expect(prettyInspect('😀'.repeat(8), { truncate: 14 })).toMatchInlineSnapshot(`"'😀😀😀😀😀😀…'"`)
    expect(prettyInspect(`a${'😀'.repeat(5)}`, { truncate: 14 })).toMatchInlineSnapshot(`"'a😀😀😀😀😀'"`)
    expect(prettyInspect(`a${'😀'.repeat(6)}`, { truncate: 14 })).toMatchInlineSnapshot(`"'a😀😀😀😀😀…'"`)
    expect(prettyInspect(`a${'😀'.repeat(7)}`, { truncate: 14 })).toMatchInlineSnapshot(`"'a😀😀😀😀😀…'"`)
    expect(prettyInspect(`a${'😀'.repeat(8)}`, { truncate: 14 })).toMatchInlineSnapshot(`"'a😀😀😀😀😀…'"`)
  })

  test('truncates array', () => {
    expect(prettyInspect([1, 2, 3, 4, 5, 6], { truncate: 20 })).toMatchInlineSnapshot(`"[ 1, 2, 3, 4, 5, 6 ]"`)
    expect(prettyInspect([1, 2, 3, 4, 5, 6, 7], { truncate: 20 })).toMatchInlineSnapshot(`"[ 1, 2, 3, 4, 5, … ]"`)
  })

  test('truncates object', () => {
    expect(prettyInspect({ a: 1, b: 2, c: 3 }, { truncate: 20 })).toMatchInlineSnapshot(`"{ a: 1, b: 2, c: 3 }"`)
    expect(prettyInspect({ a: 1, b: 2, c: 3, d: 4 }, { truncate: 20 })).toMatchInlineSnapshot(`"{ a: 1, b: 2, … }"`)
  })

  test('truncate other types', () => {
    expect(prettyInspect(new Map([['a', 1]]), { truncate: 20 })).toMatchInlineSnapshot(`"Map { 'a' => 1 }"`)
    expect(prettyInspect(new Map([['a', 1], ['b', 2]]), { truncate: 20 })).toMatchInlineSnapshot(`"Map { 'a' => 1, … }"`)
    expect(prettyInspect(new Set([1, 2, 3, 4]), { truncate: 20 })).toMatchInlineSnapshot(`"Set { 1, 2, 3, 4 }"`)
    expect(prettyInspect(new Set([1, 2, 3, 4, 5]), { truncate: 20 })).toMatchInlineSnapshot(`"Set { 1, 2, 3, … }"`)
  })

  test('multiline', () => {
    expect(prettyInspect({ a: 1, b: 2 }, { multiline: true })).toMatchInlineSnapshot(`
      "{
        a: 1,
        b: 2,
      }"
    `)
  })
})

// -- three-way inspect comparison --
// Compare prettyInspect output against node's util.inspect and loupe.inspect.
// Organized by agreement pattern to show where outputs align or diverge.

describe('inspect comparison (prettyInspect vs node vs loupe)', () => {
  const nodeOpts = { depth: null, maxArrayLength: null } // depth 2 by default

  // -- all three agree --

  test.for([
    null,
    undefined,
    true,
    false,
    -0,
    42,
    -123,
    3.14,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    123n,
    -123n,
    'hello',
    '',
    /test/gi,
    new Date(10e11),
    Symbol('test'),
    {},
    [],
    [1, 2, 3],
    [[1], [2]],
    { a: 1, b: 2 },
    { b: 1, a: 2 },
    { a: { b: { c: 1 } } },
    [{ a: 1 }, { b: 2 }],
  ])('all three match: %s', (val) => {
    const result = prettyInspect(val)
    expect(result).toBe(nodeInspect(val, nodeOpts))
    expect(result).toBe(loupeInspect(val))
  })

  // -- prettyInspect matches node, diverges from loupe --

  test('custom class — matches node (loupe omits space before brace)', () => {
    class CustomClass {
      public key: string
      constructor() {
        this.key = 'value'
      }
    }
    expect(prettyInspect(new CustomClass())).toMatchInlineSnapshot(`"CustomClass { key: 'value' }"`)
    expect(nodeInspect(new CustomClass(), nodeOpts)).toMatchInlineSnapshot(`"CustomClass { key: 'value' }"`)
    expect(loupeInspect(new CustomClass())).toMatchInlineSnapshot(`"CustomClass{ key: 'value' }"`)
  })

  test('0 — matches node (loupe shows +0)', () => {
    expect(prettyInspect(0)).toMatchInlineSnapshot(`"0"`)
    expect(nodeInspect(0)).toMatchInlineSnapshot(`"0"`)
    expect(loupeInspect(0)).toMatchInlineSnapshot(`"+0"`)
  })

  test('non-enumerable properties — matches node (loupe shows them via getOwnPropertyNames)', () => {
    const val = { visible: true }
    Object.defineProperty(val, 'hidden', { enumerable: false, value: 'secret' })
    expect(prettyInspect(val)).toMatchInlineSnapshot(`"{ visible: true }"`)
    expect(nodeInspect(val, nodeOpts)).toMatchInlineSnapshot(`"{ visible: true }"`)
    expect(loupeInspect(val)).toMatchInlineSnapshot(`"{ visible: true, hidden: 'secret' }"`)
  })

  // -- prettyInspect diverges from both --

  test('string with single quotes — no escaping (escapeString: false)', () => {
    expect(prettyInspect('it\'s')).toMatchInlineSnapshot(`"'it's'"`)
    expect(nodeInspect('it\'s')).toMatchInlineSnapshot(`""it's""`)
    expect(loupeInspect('it\'s')).toMatchInlineSnapshot(`"'it\\'s'"`)
  })

  test('named function — format differences', () => {
    function myFn() {}
    expect(prettyInspect(myFn)).toMatchInlineSnapshot(`"[Function myFn]"`)
    expect(nodeInspect(myFn)).toMatchInlineSnapshot(`"[Function: myFn]"`)
    expect(loupeInspect(myFn)).toMatchInlineSnapshot(`"[Function myFn]"`)
  })

  test('anonymous function', () => {
    expect(prettyInspect((() => {}) as unknown)).toMatchInlineSnapshot(`"[Function anonymous]"`)
    expect(nodeInspect(() => {})).toMatchInlineSnapshot(`"[Function (anonymous)]"`)
    expect(loupeInspect(() => {})).toMatchInlineSnapshot(`"[Function]"`)
  })

  test('async function — loses AsyncFunction tag', () => {
    async function asyncFn() {}
    expect(prettyInspect(asyncFn)).toMatchInlineSnapshot(`"[Function asyncFn]"`)
    expect(nodeInspect(asyncFn)).toMatchInlineSnapshot(`"[AsyncFunction: asyncFn]"`)
    expect(loupeInspect(asyncFn)).toMatchInlineSnapshot(`"[AsyncFunction asyncFn]"`)
  })

  test('generator function — loses GeneratorFunction tag', () => {
    function* genFn() {
      yield 1
    }
    expect(prettyInspect(genFn)).toMatchInlineSnapshot(`"[Function genFn]"`)
    expect(nodeInspect(genFn)).toMatchInlineSnapshot(`"[GeneratorFunction: genFn]"`)
    expect(loupeInspect(genFn)).toMatchInlineSnapshot(`"[GeneratorFunction genFn]"`)
  })

  test('Error — bracket format', () => {
    expect(prettyInspect(new Error('boom'))).toMatchInlineSnapshot(`"[Error: boom]"`)
    expect(nodeInspect(new Error('boom'))).toMatch('Error: boom\n')
    expect(loupeInspect(new Error('boom'))).toMatchInlineSnapshot(`"Error: boom"`)
  })

  test('Map — space before brace, no size prefix', () => {
    const m = new Map([['a', 1], ['b', 2]])
    expect(prettyInspect(m)).toMatchInlineSnapshot(`"Map { 'a' => 1, 'b' => 2 }"`)
    expect(nodeInspect(m)).toMatchInlineSnapshot(`"Map(2) { 'a' => 1, 'b' => 2 }"`)
    expect(loupeInspect(m)).toMatchInlineSnapshot(`"Map{ 'a' => 1, 'b' => 2 }"`)
  })

  test('Set — space before brace, no size prefix', () => {
    const s = new Set([1, 2, 3])
    expect(prettyInspect(s)).toMatchInlineSnapshot(`"Set { 1, 2, 3 }"`)
    expect(nodeInspect(s)).toMatchInlineSnapshot(`"Set(3) { 1, 2, 3 }"`)
    expect(loupeInspect(s)).toMatchInlineSnapshot(`"Set{ 1, 2, 3 }"`)
  })

  test('circular reference — no ref labels', () => {
    const val: any = {}
    val.self = val
    expect(prettyInspect(val)).toMatchInlineSnapshot(`"{ self: [Circular] }"`)
    expect(nodeInspect(val)).toMatchInlineSnapshot(`"<ref *1> { self: [Circular *1] }"`)
    // loupe: would need circular-safe call, skip
  })

  test('WeakMap', () => {
    expect(prettyInspect(new WeakMap())).toMatchInlineSnapshot(`"WeakMap {}"`)
    expect(nodeInspect(new WeakMap())).toMatchInlineSnapshot(`"WeakMap { <items unknown> }"`)
    expect(loupeInspect(new WeakMap())).toMatchInlineSnapshot(`"WeakMap{…}"`)
  })

  test('WeakSet', () => {
    expect(prettyInspect(new WeakSet())).toMatchInlineSnapshot(`"WeakSet {}"`)
    expect(nodeInspect(new WeakSet())).toMatchInlineSnapshot(`"WeakSet { <items unknown> }"`)
    expect(loupeInspect(new WeakSet())).toMatchInlineSnapshot(`"WeakSet{…}"`)
  })

  test('Promise', () => {
    expect(prettyInspect(Promise.resolve())).toMatchInlineSnapshot(`"Promise {}"`)
    expect(nodeInspect(Promise.resolve())).toMatchInlineSnapshot(`"Promise { undefined }"`)
    expect(loupeInspect(Promise.resolve())).toMatchInlineSnapshot(`"Promise{…}"`)
  })

  // -- truncation (prettyInspect vs loupe only) --
  // loupe threads a character budget through recursion, truncating structurally.
  // prettyInspect does surface-level truncation (structural summary for containers).

  describe('truncation', () => {
    test('short string — both fit', () => {
      expect(prettyInspect('hi', { truncate: 40 })).toMatchInlineSnapshot(`"'hi'"`)
      expect(loupeInspect('hi', { truncate: 40 })).toMatchInlineSnapshot(`"'hi'"`)
    })

    test('long string', () => {
      const s = '0123456789012345678901234567890123456789'
      expect(prettyInspect(s, { truncate: 20 })).toMatchInlineSnapshot(`"'012345678901234567…'"`)
      expect(loupeInspect(s, { truncate: 20 })).toMatchInlineSnapshot(`"'01234567890123456…'"`)
    })

    test('short array — both fit', () => {
      expect(prettyInspect([1, 2, 3], { truncate: 40 })).toMatchInlineSnapshot(`"[ 1, 2, 3 ]"`)
      expect(loupeInspect([1, 2, 3], { truncate: 40 })).toMatchInlineSnapshot(`"[ 1, 2, 3 ]"`)
    })

    test('long array', () => {
      const arr = [1, 2, 3, 4, 5]
      expect(prettyInspect(arr, { truncate: 15 })).toMatchInlineSnapshot(`"[ 1, 2, 3, … ]"`)
      expect(loupeInspect(arr, { truncate: 15 })).toMatchInlineSnapshot(`"[ 1, 2, …(3) ]"`)
    })

    test('array with long string values', () => {
      const arr = ['one', 'two', 'three', 'four', 'five']
      expect(prettyInspect(arr, { truncate: 40 })).toMatchInlineSnapshot(`"[ 'one', 'two', 'three', 'four', … ]"`)
      expect(loupeInspect(arr, { truncate: 40 })).toMatchInlineSnapshot(`"[ 'one', 'two', 'three', 'four', …(1) ]"`)
    })

    test('short object — both fit', () => {
      expect(prettyInspect({ a: 1 }, { truncate: 40 })).toMatchInlineSnapshot(`"{ a: 1 }"`)
      expect(loupeInspect({ a: 1 }, { truncate: 40 })).toMatchInlineSnapshot(`"{ a: 1 }"`)
    })

    test('long object', () => {
      const obj = { one: 1, two: 2, three: 3, four: 4, five: 5 }
      expect(prettyInspect(obj, { truncate: 40 })).toMatchInlineSnapshot(`"{ one: 1, two: 2, three: 3, four: 4, … }"`)
      expect(loupeInspect(obj, { truncate: 40 })).toMatchInlineSnapshot(`"{ one: 1, two: 2, three: 3, …(2) }"`)
    })

    test('nested object — stringify adaptive maxDepth halves depth until it fits', () => {
      const obj = { a: { b: { c: 'deep' } } }
      // full output is "{ a: { b: { c: 'deep' } } }" (28 chars)
      // stringify halves maxDepth, collapsing inner object to [Object]
      expect(prettyInspect(obj, { truncate: 20 })).toMatchInlineSnapshot(`"{ a: [Object] }"`)
      expect(loupeInspect(obj, { truncate: 20 })).toMatchInlineSnapshot(`"{ a: { …(1) } }"`)
    })

    test('Map', () => {
      const m = new Map([['a', 1], ['b', 2], ['c', 3]])
      expect(prettyInspect(m, { truncate: 20 })).toMatchInlineSnapshot(`"Map { 'a' => 1, … }"`)
      expect(loupeInspect(m, { truncate: 20 })).toMatchInlineSnapshot(`"Map{ …(3) }"`)
    })

    test('Set', () => {
      const s = new Set([1, 2, 3, 4, 5])
      expect(prettyInspect(s, { truncate: 15 })).toMatchInlineSnapshot(`"Set { 1, 2, … }"`)
      expect(loupeInspect(s, { truncate: 15 })).toMatchInlineSnapshot(`"Set{ 1, …(4) }"`)
    })

    test('function', () => {
      function myLongFunctionName() {}
      expect(prettyInspect(myLongFunctionName, { truncate: 10 })).toMatchInlineSnapshot(`"[Function myLongFunctionName]"`)
      expect(loupeInspect(myLongFunctionName, { truncate: 10 })).toMatchInlineSnapshot(`"[Function …]"`)
    })
  })
})
