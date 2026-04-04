import { format, plugins } from '@vitest/pretty-format'
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

// -- validation --

describe('validation', () => {
  test('throws on unknown option', () => {
    expect(() => {
      // @ts-expect-error testing runtime
      format({}, { badOption: true })
    }).toThrowErrorMatchingInlineSnapshot(`[Error: pretty-format: Unknown option "badOption".]`)
  })
})
