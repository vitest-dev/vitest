import { inspect as nodeInspect } from 'node:util'
import { format, plugins } from '@vitest/pretty-format'
import { prettyInspect } from '@vitest/utils/display'
import { inspect as loupeInspect } from 'loupe'
import { describe, expect, test } from 'vitest'

// TODO
// - multiline output should use inline snapshot?

function returnArguments(..._args: Array<unknown>) {
  // eslint-disable-next-line prefer-rest-params
  return arguments
}

// -- value types --

describe('format()', () => {
  test('null', () => {
    expect(format(null)).toBe('null')
  })

  test('undefined', () => {
    expect(format(undefined)).toBe('undefined')
  })

  test('true', () => {
    expect(format(true)).toBe('true')
  })

  test('false', () => {
    expect(format(false)).toBe('false')
  })

  test('positive number', () => {
    expect(format(123)).toBe('123')
  })

  test('negative number', () => {
    expect(format(-123)).toBe('-123')
  })

  test('zero', () => {
    expect(format(0)).toBe('0')
  })

  test('negative zero', () => {
    expect(format(-0)).toBe('-0')
  })

  test('NaN', () => {
    expect(format(Number.NaN)).toBe('NaN')
  })

  test('Infinity', () => {
    expect(format(Number.POSITIVE_INFINITY)).toBe('Infinity')
  })

  test('-Infinity', () => {
    expect(format(Number.NEGATIVE_INFINITY)).toBe('-Infinity')
  })

  test('float', () => {
    expect(format(3.14)).toBe('3.14')
  })

  test('positive bigint', () => {
    expect(format(123n)).toBe('123n')
  })

  test('negative bigint', () => {
    expect(format(-123n)).toBe('-123n')
  })

  test('zero bigint', () => {
    expect(format(0n)).toBe('0n')
  })

  test('string', () => {
    expect(format('string')).toBe('"string"')
  })

  test('empty string', () => {
    expect(format('')).toBe('""')
  })

  test('string with double quotes and backslash (escapeString default)', () => {
    expect(format('"\'\\'))
      .toBe('"\\"\'\\\\"')
  })

  test('multiline string', () => {
    expect(format('line 1\nline 2')).toBe('"line 1\nline 2"')
  })

  test('named symbol', () => {
    expect(format(Symbol('test'))).toBe('Symbol(test)')
  })

  test('unnamed symbol', () => {
    expect(format(Symbol(''))).toBe('Symbol()')
  })

  test('named function', () => {
    function named() {}
    expect(format(named)).toBe('[Function named]')
  })

  test('anonymous function', () => {
    expect(format(() => {})).toBe('[Function anonymous]')
  })

  test('named generator function', () => {
    function* gen() {
      yield 1
    }
    expect(format(gen)).toBe('[Function gen]')
  })

  test('date', () => {
    expect(format(new Date(10e11))).toBe('2001-09-09T01:46:40.000Z')
  })

  test('invalid date', () => {
    expect(format(new Date(Infinity))).toBe('Date { NaN }')
  })

  test('regexp from literal', () => {
    expect(format(/regexp/gi)).toBe('/regexp/gi')
  })

  test('regexp from constructor', () => {
    expect(format(/regexp/)).toBe('/regexp/')
  })

  test('error', () => {
    expect(format(new Error('test'))).toBe('[Error: test]')
  })

  test('typed error with message', () => {
    expect(format(new TypeError('message'))).toBe('[TypeError: message]')
  })

  test('WeakMap', () => {
    expect(format(new WeakMap())).toBe('WeakMap {}')
  })

  test('WeakSet', () => {
    expect(format(new WeakSet())).toBe('WeakSet {}')
  })

  test('Promise', () => {
    expect(format(Promise.resolve())).toBe('Promise {}')
  })
})

// -- collections --

describe('arrays', () => {
  test('empty', () => {
    expect(format([])).toBe('Array []')
  })

  test('with items', () => {
    expect(format([1, 2, 3])).toBe('Array [\n  1,\n  2,\n  3,\n]')
  })

  test('sparse with only holes', () => {
    // eslint-disable-next-line no-sparse-arrays
    expect(format([, , ,])).toBe('Array [\n  ,\n  ,\n  ,\n]')
  })

  test('sparse with items', () => {
    // eslint-disable-next-line no-sparse-arrays
    expect(format([1, , , 4])).toBe('Array [\n  1,\n  ,\n  ,\n  4,\n]')
  })

  test('sparse with undefined', () => {
    // eslint-disable-next-line no-sparse-arrays
    expect(format([1, , undefined, , 4])).toBe(
      'Array [\n  1,\n  ,\n  undefined,\n  ,\n  4,\n]',
    )
  })

  test('nested', () => {
    expect(format([[1, 2]])).toBe(
      'Array [\n  Array [\n    1,\n    2,\n  ],\n]',
    )
  })

  test('typed array empty', () => {
    expect(format(new Uint8Array(0))).toBe('Uint8Array []')
  })

  test('typed array with items', () => {
    expect(format(new Uint32Array(3))).toBe(
      'Uint32Array [\n  0,\n  0,\n  0,\n]',
    )
  })

  test('ArrayBuffer', () => {
    expect(format(new ArrayBuffer(3))).toBe(
      'ArrayBuffer [\n  0,\n  0,\n  0,\n]',
    )
  })

  test('DataView', () => {
    expect(format(new DataView(new ArrayBuffer(3)))).toBe(
      'DataView [\n  0,\n  0,\n  0,\n]',
    )
  })
})

describe('objects', () => {
  test('empty', () => {
    expect(format({})).toBe('Object {}')
  })

  test('with properties', () => {
    expect(format({ prop1: 'value1', prop2: 'value2' })).toBe(
      'Object {\n  "prop1": "value1",\n  "prop2": "value2",\n}',
    )
  })

  test('keys are sorted by default', () => {
    expect(format({ b: 1, a: 2 })).toBe(
      'Object {\n  "a": 2,\n  "b": 1,\n}',
    )
  })

  test('deeply nested', () => {
    expect(format({ a: { b: { c: 'val' } } })).toBe(
      'Object {\n  "a": Object {\n    "b": Object {\n      "c": "val",\n    },\n  },\n}',
    )
  })

  test('Object.create(null)', () => {
    expect(format(Object.create(null))).toBe('Object {}')
  })

  test('custom constructor name', () => {
    class Foo { x = 1 }
    expect(format(new Foo())).toBe('Foo {\n  "x": 1,\n}')
  })

  test('with symbol properties', () => {
    const val: any = { prop: 'value' }
    val[Symbol('sym')] = 'symval'
    expect(format(val)).toBe(
      'Object {\n  "prop": "value",\n  Symbol(sym): "symval",\n}',
    )
  })

  test('skips non-enumerable string keys', () => {
    const val = { enumerable: true }
    Object.defineProperty(val, 'hidden', { enumerable: false, value: false })
    expect(format(val)).toBe('Object {\n  "enumerable": true,\n}')
  })

  test('skips non-enumerable symbol keys', () => {
    const val = { enumerable: true }
    Object.defineProperty(val, Symbol('hidden'), { enumerable: false, value: false })
    expect(format(val)).toBe('Object {\n  "enumerable": true,\n}')
  })

  test('circular reference', () => {
    const val: any = {}
    val.self = val
    expect(format(val)).toBe('Object {\n  "self": [Circular],\n}')
  })

  test('parallel references', () => {
    const inner = {}
    expect(format({ a: inner, b: inner })).toBe(
      'Object {\n  "a": Object {},\n  "b": Object {},\n}',
    )
  })
})

describe('Map', () => {
  test('empty', () => {
    expect(format(new Map())).toBe('Map {}')
  })

  test('with string keys', () => {
    const val = new Map([['a', 1], ['b', 2]])
    expect(format(val)).toBe(
      'Map {\n  "a" => 1,\n  "b" => 2,\n}',
    )
  })

  test('with non-string keys', () => {
    const val = new Map<unknown, unknown>([
      [false, 'bool'],
      [null, 'null'],
      [undefined, 'undef'],
      [42, 'num'],
    ])
    expect(format(val)).toBe(
      'Map {\n  false => "bool",\n  null => "null",\n  undefined => "undef",\n  42 => "num",\n}',
    )
  })
})

describe('Set', () => {
  test('empty', () => {
    expect(format(new Set())).toBe('Set {}')
  })

  test('with values', () => {
    expect(format(new Set(['a', 'b']))).toBe(
      'Set {\n  "a",\n  "b",\n}',
    )
  })
})

describe('Arguments', () => {
  test('empty', () => {
    expect(format(returnArguments())).toBe('Arguments []')
  })

  test('with values', () => {
    expect(format(returnArguments(1, 2, 3))).toBe(
      'Arguments [\n  1,\n  2,\n  3,\n]',
    )
  })
})

// -- existing options --

describe('indent option', () => {
  const val = [{ a: 1 }]

  test('default (2 spaces)', () => {
    expect(format(val)).toBe(
      'Array [\n  Object {\n    "a": 1,\n  },\n]',
    )
  })

  test('0 spaces', () => {
    expect(format(val, { indent: 0 })).toBe(
      'Array [\nObject {\n"a": 1,\n},\n]',
    )
  })

  test('4 spaces', () => {
    expect(format(val, { indent: 4 })).toBe(
      'Array [\n    Object {\n        "a": 1,\n    },\n]',
    )
  })
})

describe('maxDepth option', () => {
  test('truncates nested structures', () => {
    const val = { a: { b: { c: 'deep' } }, arr: [[1]] }
    expect(format(val, { maxDepth: 1 })).toBe(
      'Object {\n  "a": [Object],\n  "arr": [Array],\n}',
    )
  })

  test('maxDepth with Map and Set', () => {
    const val = { m: new Map([['k', 'v']]), s: new Set([1]) }
    expect(format(val, { maxDepth: 1 })).toBe(
      'Object {\n  "m": [Map],\n  "s": [Set],\n}',
    )
  })
})

describe('maxWidth option', () => {
  test('truncates arrays', () => {
    expect(format([1, 2, 3, 4, 5], { maxWidth: 3 })).toBe(
      'Array [\n  1,\n  2,\n  3,\n  …\n]',
    )
  })

  test('truncates sets', () => {
    expect(format(new Set([1, 2, 3, 4, 5]), { maxWidth: 3 })).toBe(
      'Set {\n  1,\n  2,\n  3,\n  …\n}',
    )
  })

  test('truncates maps', () => {
    const val = new Map([['a', 1], ['b', 2], ['c', 3], ['d', 4]])
    expect(format(val, { maxWidth: 2 })).toBe(
      'Map {\n  "a" => 1,\n  "b" => 2,\n  …\n}',
    )
  })
})

describe('min option', () => {
  test('basic values', () => {
    expect(format({ a: [1, 2], b: 'str' }, { min: true })).toBe(
      '{"a": [1, 2], "b": "str"}',
    )
  })

  test('Map and Set', () => {
    expect(format(new Map([['k', 'v']]), { min: true })).toBe(
      'Map {"k" => "v"}',
    )
    expect(format(new Set([1, 2]), { min: true })).toBe(
      'Set {1, 2}',
    )
  })

  test('does not allow indent !== 0 with min', () => {
    expect(() => format(1, { indent: 1, min: true })).toThrow(
      'Options "min" and "indent" cannot be used together.',
    )
  })
})

describe('compareKeys option', () => {
  test('null preserves insertion order', () => {
    expect(format({ b: 1, a: 2 }, { compareKeys: null })).toBe(
      'Object {\n  "b": 1,\n  "a": 2,\n}',
    )
  })

  test('custom sort (reverse)', () => {
    const compareKeys = (a: string, b: string) => (a > b ? -1 : 1)
    expect(format({ a: 1, b: 2 }, { compareKeys })).toBe(
      'Object {\n  "b": 2,\n  "a": 1,\n}',
    )
  })
})

describe('callToJSON option', () => {
  test('calls toJSON by default', () => {
    expect(format({ toJSON: () => ({ replaced: true }), orig: 1 })).toBe(
      'Object {\n  "replaced": true,\n}',
    )
  })

  test('skips toJSON when false', () => {
    const val = { toJSON: () => 'ignored', orig: 1 }
    const result = format(val, { callToJSON: false })
    expect(result).toContain('"orig": 1')
    expect(result).toContain('"toJSON"')
  })

  test('does not call toJSON recursively', () => {
    expect(format({ toJSON: () => ({ toJSON: () => 'deep' }) })).toBe(
      'Object {\n  "toJSON": [Function toJSON],\n}',
    )
  })
})

describe('printBasicPrototype option', () => {
  test('includes prototype name by default', () => {
    expect(format({})).toBe('Object {}')
    expect(format([])).toBe('Array []')
  })

  test('omits basic prototype names when false', () => {
    expect(format({}, { printBasicPrototype: false })).toBe('{}')
    expect(format([], { printBasicPrototype: false })).toBe('[]')
  })

  test('still shows custom constructor names when false', () => {
    class Custom {}
    expect(format(new Custom(), { printBasicPrototype: false })).toBe('Custom {}')
  })
})

describe('printFunctionName option', () => {
  test('prints function name by default', () => {
    function myFn() {}
    expect(format(myFn)).toBe('[Function myFn]')
  })

  test('hides function name when false', () => {
    function myFn() {}
    expect(format(myFn, { printFunctionName: false })).toBe('[Function]')
  })
})

describe('escapeString option', () => {
  test('escapes by default', () => {
    expect(format('"hello"')).toBe('"\\\"hello\\\""')
  })

  test('does not escape when false', () => {
    expect(format('"hello"', { escapeString: false })).toBe('""hello""')
  })
})

describe('escapeRegex option', () => {
  test('no escaping by default', () => {
    expect(format(/regexp\d/gi)).toBe('/regexp\\d/gi')
  })

  test('escapes when true', () => {
    expect(format(/regexp\d/gi, { escapeRegex: true })).toBe('/regexp\\\\d/gi')
  })
})

// -- new options (this PR) --

describe('singleQuote option', () => {
  test('uses double quotes by default', () => {
    expect(format('hello')).toBe('"hello"')
  })

  test('uses single quotes when true', () => {
    expect(format('hello', { singleQuote: true })).toBe('\'hello\'')
  })

  test('escapes single quotes inside string when singleQuote + escapeString', () => {
    expect(format('it\'s', { singleQuote: true })).toBe('\'it\\\'s\'')
  })

  test('escapes backslash when singleQuote + escapeString', () => {
    expect(format('a\\b', { singleQuote: true })).toBe('\'a\\\\b\'')
  })

  test('does not escape double quotes when singleQuote', () => {
    expect(format('say "hi"', { singleQuote: true })).toBe('\'say "hi"\'')
  })

  test('applies to object values', () => {
    expect(format({ a: 'b' }, { singleQuote: true, min: true })).toBe(
      '{\'a\': \'b\'}',
    )
  })

  test('applies to Map keys and values', () => {
    expect(format(new Map([['k', 'v']]), { singleQuote: true, min: true })).toBe(
      'Map {\'k\' => \'v\'}',
    )
  })
})

describe('quoteKeys option', () => {
  test('quotes all keys by default', () => {
    expect(format({ a: 1 }, { min: true })).toBe('{"a": 1}')
  })

  test('does not quote valid identifiers when false', () => {
    expect(format({ a: 1, foo_bar: 2, $x: 3 }, { quoteKeys: false, min: true })).toBe(
      '{$x: 3, a: 1, foo_bar: 2}',
    )
  })

  test('still quotes non-identifier keys when false', () => {
    expect(format({ 'has space': 1 }, { quoteKeys: false, min: true })).toBe(
      '{"has space": 1}',
    )
  })

  test('still quotes keys starting with digit when false', () => {
    expect(format({ '0abc': 1 }, { quoteKeys: false, min: true })).toBe(
      '{"0abc": 1}',
    )
  })

  test('still quotes empty key when false', () => {
    expect(format({ '': 1 }, { quoteKeys: false, min: true })).toBe(
      '{"": 1}',
    )
  })

  test('still quotes key with dash when false', () => {
    expect(format({ 'my-key': 1 }, { quoteKeys: false, min: true })).toBe(
      '{"my-key": 1}',
    )
  })
})

describe('spacingInner / spacingOuter options', () => {
  test('min: true defaults', () => {
    // min: true → spacingInner: ' ', spacingOuter: ''
    expect(format({ a: 1, b: 2 }, { min: true })).toBe('{"a": 1, "b": 2}')
  })

  test('spacingOuter override with min: true', () => {
    // override spacingOuter to add space around braces (loupe-like)
    expect(format({ a: 1 }, { min: true, spacingOuter: ' ' })).toBe('{ "a": 1 }')
  })

  test('spacingInner override', () => {
    // min: true still places comma before spacingInner
    expect(format([1, 2], { min: true, spacingInner: ' | ' })).toBe('[1, | 2]')
  })
})

// -- ErrorPlugin --

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
    expect(result).toContain('AggregateError')
    expect(result).toContain('"message": "multiple"')
    expect(result).toContain('"errors"')
  })

  test('circular error', () => {
    const err = new Error('loop') as any
    err.self = err
    const result = format(err, { plugins: [plugins.Error] })
    expect(result).toContain('[Circular]')
  })
})

// -- plugins --

describe('plugins', () => {
  test('custom plugin with test/print', () => {
    class Foo { value = 42 }
    const result = format(new Foo(), {
      plugins: [{
        test: (val: unknown) => val instanceof Foo,
        print: (val: any) => `Foo(${val.value})`,
      }],
    })
    expect(result).toBe('Foo(42)')
  })

  test('custom plugin with test/serialize', () => {
    class Bar {}
    const result = format(new Bar(), {
      plugins: [{
        test: (val: unknown) => val instanceof Bar,
        serialize: () => 'serialized Bar',
      }],
    })
    expect(result).toBe('serialized Bar')
  })

  test('plugin returning empty string', () => {
    const result = format('x', {
      plugins: [{
        test: () => true,
        print: () => '',
      }],
    })
    expect(result).toBe('')
  })

  test('throws if plugin returns non-string', () => {
    expect(() => format(1, {
      plugins: [{
        test: () => true,
        // @ts-expect-error testing runtime
        print: (val: unknown) => val,
      }],
    })).toThrow('must return type "string"')
  })
})

// -- validation --

describe('validation', () => {
  test('throws on unknown option', () => {
    expect(() => {
      // @ts-expect-error testing runtime
      format({}, { badOption: true })
    }).toThrow('Unknown option "badOption"')
  })
})

// -- prettyInspect --

describe('prettyInspect', () => {
  test('no truncation by default (truncate: 0)', () => {
    const long = 'a'.repeat(200)
    expect(prettyInspect(long)).toBe(`'${long}'`)
  })

  test('no truncation when value fits within threshold', () => {
    expect(prettyInspect('short', { truncate: 100 })).toBe('\'short\'')
  })

  test('truncates string', () => {
    const long = '0123456789012345678901234567890123456789'
    expect(prettyInspect(long, { truncate: 20 })).toMatchInlineSnapshot(`"'012345678901234...'"`)
  })

  test('truncates surragete pair correctly', () => {
    expect(prettyInspect('😀'.repeat(5), { truncate: 14 })).toMatchInlineSnapshot(`"'😀😀😀😀😀'"`)
    expect(prettyInspect('😀'.repeat(6), { truncate: 14 })).toMatchInlineSnapshot(`"'😀😀😀😀😀😀'"`)
    expect(prettyInspect('😀'.repeat(7), { truncate: 14 })).toMatchInlineSnapshot(`"'😀😀😀😀...'"`)
    expect(prettyInspect('😀'.repeat(8), { truncate: 14 })).toMatchInlineSnapshot(`"'😀😀😀😀...'"`)
    expect(prettyInspect(`a${'😀'.repeat(5)}`, { truncate: 14 })).toMatchInlineSnapshot(`"'a😀😀😀😀😀'"`)
    expect(prettyInspect(`a${'😀'.repeat(6)}`, { truncate: 14 })).toMatchInlineSnapshot(`"'a😀😀😀😀...'"`)
    expect(prettyInspect(`a${'😀'.repeat(7)}`, { truncate: 14 })).toMatchInlineSnapshot(`"'a😀😀😀😀...'"`)
    expect(prettyInspect(`a${'😀'.repeat(8)}`, { truncate: 14 })).toMatchInlineSnapshot(`"'a😀😀😀😀...'"`)
  })

  test('truncates array', () => {
    expect(prettyInspect([1, 2, 3, 4, 5], { truncate: 10 })).toBe('[ Array(5) ]')
  })

  test('truncates object', () => {
    expect(prettyInspect({ a: 1, b: 2, c: 3 }, { truncate: 15 })).toBe('{ Object (a, b, ...) }')
  })

  test('truncate other types', () => {
    expect(prettyInspect(new Map([['a', 1], ['b', 2]]), { truncate: 5 })).toMatchInlineSnapshot(`"[Map]"`)
    expect(prettyInspect(new Set([1, 2, 3]), { truncate: 5 })).toMatchInlineSnapshot(`"[Set]"`)
  })
})

// -- util.inspect conformance --
// pretty-format with the right options should approximate Node's util.inspect
// output style. Tests are split into exact matches (compared directly via
// test.each loop) and known divergences (tested individually).

describe('util.inspect conformance', () => {
  // values where pretty-format output exactly matches util.inspect
  test.each([
    null,
    undefined,
    true,
    false,
    0,
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
  ])('matches util.inspect: %s', (val) => {
    expect(prettyInspect(val)).toBe(nodeInspect(val, { depth: null, maxArrayLength: null }))
  })

  // values where output diverges from util.inspect

  test('custom class', () => {
    class CustomClass {
      public key: string
      constructor() {
        this.key = 'value'
      }
    }
    // TODO?
    expect(prettyInspect(new CustomClass())).toMatchInlineSnapshot(`"{ key: 'value' }"`)
    expect(nodeInspect(new CustomClass())).toMatchInlineSnapshot(`"CustomClass { key: 'value' }"`)
  })

  test('string with single quotes — no escaping (stringify uses escapeString: false)', () => {
    expect(prettyInspect('it\'s')).toBe('\'it\'s\'')
    expect(nodeInspect('it\'s')).toMatchInlineSnapshot(`""it's""`)
  })

  test('function — no colon, different anonymous style', () => {
    function myFn() {}
    expect(prettyInspect(myFn)).toBe('[Function myFn]')
    expect(nodeInspect(myFn)).toMatchInlineSnapshot(`"[Function: myFn]"`)

    expect(prettyInspect((() => {}) as unknown)).toBe('[Function anonymous]')
    expect(nodeInspect(() => {})).toMatchInlineSnapshot(`"[Function (anonymous)]"`)
  })

  test('error — bracket format, no stack', () => {
    expect(prettyInspect(new Error('boom'))).toBe('[Error: boom]')
    expect(nodeInspect(new Error('boom'))).toMatch('Error: boom\n')
  })

  test('Map — no size prefix', () => {
    const m = new Map([['a', 1], ['b', 2]])
    expect(prettyInspect(m)).toBe('Map { \'a\' => 1, \'b\' => 2 }')
    expect(nodeInspect(m)).toMatchInlineSnapshot(`"Map(2) { 'a' => 1, 'b' => 2 }"`)
  })

  test('Set — no size prefix', () => {
    const s = new Set([1, 2, 3])
    expect(prettyInspect(s)).toBe('Set { 1, 2, 3 }')
    expect(nodeInspect(s)).toMatchInlineSnapshot(`"Set(3) { 1, 2, 3 }"`)
  })

  test('circular reference — no ref labels', () => {
    const val: any = {}
    val.self = val
    expect(prettyInspect(val)).toBe('{ self: [Circular] }')
    expect(nodeInspect(val)).toMatchInlineSnapshot(`"<ref *1> { self: [Circular *1] }"`)
  })

  test('WeakMap — empty braces vs items unknown', () => {
    expect(prettyInspect(new WeakMap())).toBe('WeakMap {}')
    expect(nodeInspect(new WeakMap())).toMatchInlineSnapshot(`"WeakMap { <items unknown> }"`)
  })

  test('WeakSet — empty braces vs items unknown', () => {
    expect(prettyInspect(new WeakSet())).toBe('WeakSet {}')
    expect(nodeInspect(new WeakSet())).toMatchInlineSnapshot(`"WeakSet { <items unknown> }"`)
  })

  test('Promise — opaque, min mode drops constructor', () => {
    expect(prettyInspect(Promise.resolve())).toBe('{}')
    expect(nodeInspect(Promise.resolve())).toMatchInlineSnapshot(`"Promise { undefined }"`)
  })
})

// -- loupe comparison --
// Document where prettyInspect matches or differs from loupe.inspect.
// loupe is the formatter being replaced — these tests track the migration.
// All tests use inline snapshots to show both outputs side by side.

describe('loupe comparison', () => {
  const loupeOpts = { truncate: Infinity } // no truncation

  // values where prettyInspect output matches loupe exactly
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
    'hello',
    '',
    /test/gi,
    new Date(10e11),
    Symbol('test'),
    {},
    [],
    [1, 2, 3],
    { a: 1, b: 2 },
    { a: { b: { c: 1 } } },
  ])('matches loupe: %s', (val) => {
    expect(prettyInspect(val)).toBe(loupeInspect(val, loupeOpts))
  })

  // -- known divergences --

  test('custom class', () => {
    class CustomClass {
      public key: string
      constructor() {
        this.key = 'value'
      }
    }
    expect(prettyInspect(new CustomClass())).toMatchInlineSnapshot(`"{ key: 'value' }"`)
    expect(loupeInspect(new CustomClass(), loupeOpts)).toMatchInlineSnapshot(`"CustomClass{ key: 'value' }"`)
  })

  test('0 — loupe shows +0', () => {
    expect(prettyInspect(0)).toMatchInlineSnapshot(`"0"`)
    expect(loupeInspect(0, loupeOpts)).toMatchInlineSnapshot(`"+0"`)
  })

  test('string with single quotes — prettyInspect does not escape (escapeString: false)', () => {
    expect(prettyInspect('it\'s')).toMatchInlineSnapshot(`"'it's'"`)
    expect(loupeInspect('it\'s', loupeOpts)).toMatchInlineSnapshot(`"'it\\'s'"`)
  })

  test('anonymous function — prettyInspect adds "anonymous"', () => {
    expect(prettyInspect(() => {})).toMatchInlineSnapshot(`"[Function anonymous]"`)
    expect(loupeInspect(() => {}, loupeOpts)).toMatchInlineSnapshot(`"[Function]"`)
  })

  test('async function — prettyInspect loses AsyncFunction tag', () => {
    async function asyncFn() {}
    expect(prettyInspect(asyncFn)).toMatchInlineSnapshot(`"[Function asyncFn]"`)
    expect(loupeInspect(asyncFn, loupeOpts)).toMatchInlineSnapshot(`"[AsyncFunction asyncFn]"`)
  })

  test('generator function — prettyInspect loses GeneratorFunction tag', () => {
    function* genFn() {
      yield 1
    }
    expect(prettyInspect(genFn)).toMatchInlineSnapshot(`"[Function genFn]"`)
    expect(loupeInspect(genFn, loupeOpts)).toMatchInlineSnapshot(`"[GeneratorFunction genFn]"`)
  })

  test('Map — prettyInspect adds space before brace', () => {
    expect(prettyInspect(new Map([['a', 1]]))).toMatchInlineSnapshot(`"Map { 'a' => 1 }"`)
    expect(loupeInspect(new Map([['a', 1]]), loupeOpts)).toMatchInlineSnapshot(`"Map{ 'a' => 1 }"`)
  })

  test('Set — prettyInspect adds space before brace', () => {
    expect(prettyInspect(new Set([1, 2]))).toMatchInlineSnapshot(`"Set { 1, 2 }"`)
    expect(loupeInspect(new Set([1, 2]), loupeOpts)).toMatchInlineSnapshot(`"Set{ 1, 2 }"`)
  })

  test('Error — prettyInspect uses bracket format', () => {
    expect(prettyInspect(new Error('boom'))).toMatchInlineSnapshot(`"[Error: boom]"`)
    expect(loupeInspect(new Error('boom'), loupeOpts)).toMatchInlineSnapshot(`"Error: boom"`)
  })

  test('WeakMap — prettyInspect shows empty braces', () => {
    expect(prettyInspect(new WeakMap())).toMatchInlineSnapshot(`"WeakMap {}"`)
    expect(loupeInspect(new WeakMap(), loupeOpts)).toMatchInlineSnapshot(`"WeakMap{…}"`)
  })

  test('WeakSet — prettyInspect shows empty braces', () => {
    expect(prettyInspect(new WeakSet())).toMatchInlineSnapshot(`"WeakSet {}"`)
    expect(loupeInspect(new WeakSet(), loupeOpts)).toMatchInlineSnapshot(`"WeakSet{…}"`)
  })

  test('Promise — prettyInspect drops constructor name in min mode', () => {
    expect(prettyInspect(Promise.resolve())).toMatchInlineSnapshot(`"{}"`)
    expect(loupeInspect(Promise.resolve(), loupeOpts)).toMatchInlineSnapshot(`"Promise{…}"`)
  })

  // -- truncation comparison --
  // loupe threads a character budget through recursion, truncating structurally.
  // prettyInspect does surface-level truncation (structural summary for containers).

  describe('truncation', () => {
    test('short string — both fit', () => {
      expect(prettyInspect('hi', { truncate: 40 })).toMatchInlineSnapshot(`"'hi'"`)
      expect(loupeInspect('hi', { truncate: 40 })).toMatchInlineSnapshot(`"'hi'"`)
    })

    test('long string', () => {
      const s = '0123456789012345678901234567890123456789'
      expect(prettyInspect(s, { truncate: 20 })).toMatchInlineSnapshot(`"'012345678901234...'"`)
      expect(loupeInspect(s, { truncate: 20 })).toMatchInlineSnapshot(`"'01234567890123456…'"`)
    })

    test('short array — both fit', () => {
      expect(prettyInspect([1, 2, 3], { truncate: 40 })).toMatchInlineSnapshot(`"[ 1, 2, 3 ]"`)
      expect(loupeInspect([1, 2, 3], { truncate: 40 })).toMatchInlineSnapshot(`"[ 1, 2, 3 ]"`)
    })

    test('long array', () => {
      const arr = [1, 2, 3, 4, 5]
      expect(prettyInspect(arr, { truncate: 15 })).toMatchInlineSnapshot(`"[ Array(5) ]"`)
      expect(loupeInspect(arr, { truncate: 15 })).toMatchInlineSnapshot(`"[ 1, 2, …(3) ]"`)
    })

    test('array with long string values', () => {
      const arr = ['one', 'two', 'three', 'four', 'five']
      expect(prettyInspect(arr, { truncate: 40 })).toMatchInlineSnapshot(`"[ Array(5) ]"`)
      expect(loupeInspect(arr, { truncate: 40 })).toMatchInlineSnapshot(`"[ 'one', 'two', 'three', 'four', …(1) ]"`)
    })

    test('short object — both fit', () => {
      expect(prettyInspect({ a: 1 }, { truncate: 40 })).toMatchInlineSnapshot(`"{ a: 1 }"`)
      expect(loupeInspect({ a: 1 }, { truncate: 40 })).toMatchInlineSnapshot(`"{ a: 1 }"`)
    })

    test('long object', () => {
      const obj = { one: 1, two: 2, three: 3, four: 4, five: 5 }
      expect(prettyInspect(obj, { truncate: 40 })).toMatchInlineSnapshot(`"{ Object (one, two, ...) }"`)
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
      expect(prettyInspect(m, { truncate: 20 })).toMatchInlineSnapshot(`"[Map]"`)
      expect(loupeInspect(m, { truncate: 20 })).toMatchInlineSnapshot(`"Map{ …(3) }"`)
    })

    test('Set', () => {
      const s = new Set([1, 2, 3, 4, 5])
      expect(prettyInspect(s, { truncate: 15 })).toMatchInlineSnapshot(`"[Set]"`)
      expect(loupeInspect(s, { truncate: 15 })).toMatchInlineSnapshot(`"Set{ 1, …(4) }"`)
    })

    test('function', () => {
      function myLongFunctionName() {}
      expect(prettyInspect(myLongFunctionName, { truncate: 10 })).toMatchInlineSnapshot(`"[Function myLongFunctionName]"`)
      expect(loupeInspect(myLongFunctionName, { truncate: 10 })).toMatchInlineSnapshot(`"[Function …]"`)
    })
  })
})
