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

  test('truncates string with ellipsis', () => {
    const long = '0123456789012345678901234567890123456789'
    const result = prettyInspect(long, { truncate: 20 })
    expect(result.length).toBe(20)
    expect(result.endsWith('\u2026')).toBe(true)
  })

  test('truncates array to structural summary', () => {
    expect(prettyInspect([1, 2, 3, 4, 5], { truncate: 5 })).toBe('[ Array(5) ]')
  })

  test('truncates object to structural summary (few keys)', () => {
    expect(prettyInspect({ a: 1 }, { truncate: 5 })).toBe('{ Object (a) }')
  })

  test('truncates object to structural summary (many keys)', () => {
    expect(prettyInspect({ a: 1, b: 2, c: 3 }, { truncate: 5 })).toBe('{ Object (a, b, ...) }')
  })

  test('truncates function to summary', () => {
    function myFn() {}
    expect(prettyInspect(myFn, { truncate: 5 })).toBe('[Function: myFn]')
  })

  test('truncates anonymous function to summary', () => {
    expect(prettyInspect(() => {}, { truncate: 5 })).toBe('[Function]')
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
  const pi = (val: unknown) => prettyInspect(val)
  const li = (val: unknown) => loupeInspect(val, loupeOpts)

  // -- primitives --

  test('null / undefined', () => {
    expect(pi(null)).toMatchInlineSnapshot(`"null"`)
    expect(li(null)).toMatchInlineSnapshot(`"null"`)
    expect(pi(undefined)).toMatchInlineSnapshot(`"undefined"`)
    expect(li(undefined)).toMatchInlineSnapshot(`"undefined"`)
  })

  test('booleans', () => {
    expect(pi(true)).toMatchInlineSnapshot(`"true"`)
    expect(li(true)).toMatchInlineSnapshot(`"true"`)
    expect(pi(false)).toMatchInlineSnapshot(`"false"`)
    expect(li(false)).toMatchInlineSnapshot(`"false"`)
  })

  test('numbers', () => {
    expect(pi(0)).toMatchInlineSnapshot(`"0"`)
    expect(li(0)).toMatchInlineSnapshot(`"+0"`)
    expect(pi(-0)).toMatchInlineSnapshot(`"-0"`)
    expect(li(-0)).toMatchInlineSnapshot(`"-0"`)
    expect(pi(42)).toMatchInlineSnapshot(`"42"`)
    expect(li(42)).toMatchInlineSnapshot(`"42"`)
    expect(pi(-123)).toMatchInlineSnapshot(`"-123"`)
    expect(li(-123)).toMatchInlineSnapshot(`"-123"`)
    expect(pi(3.14)).toMatchInlineSnapshot(`"3.14"`)
    expect(li(3.14)).toMatchInlineSnapshot(`"3.14"`)
    expect(pi(Number.NaN)).toMatchInlineSnapshot(`"NaN"`)
    expect(li(Number.NaN)).toMatchInlineSnapshot(`"NaN"`)
    expect(pi(Number.POSITIVE_INFINITY)).toMatchInlineSnapshot(`"Infinity"`)
    expect(li(Number.POSITIVE_INFINITY)).toMatchInlineSnapshot(`"Infinity"`)
    expect(pi(Number.NEGATIVE_INFINITY)).toMatchInlineSnapshot(`"-Infinity"`)
    expect(li(Number.NEGATIVE_INFINITY)).toMatchInlineSnapshot(`"-Infinity"`)
  })

  test('bigint', () => {
    expect(pi(123n)).toMatchInlineSnapshot(`"123n"`)
    expect(li(123n)).toMatchInlineSnapshot(`"123n"`)
  })

  test('strings', () => {
    expect(pi('hello')).toMatchInlineSnapshot(`"'hello'"`)
    expect(li('hello')).toMatchInlineSnapshot(`"'hello'"`)
    expect(pi('')).toMatchInlineSnapshot(`"''"`)
    expect(li('')).toMatchInlineSnapshot(`"''"`)
    // single quote escaping
    expect(pi('it\'s')).toMatchInlineSnapshot(`"'it's'"`)
    expect(li('it\'s')).toMatchInlineSnapshot(`"'it\\'s'"`)
  })

  test('symbol', () => {
    expect(pi(Symbol('test'))).toMatchInlineSnapshot(`"Symbol(test)"`)
    expect(li(Symbol('test'))).toMatchInlineSnapshot(`"Symbol(test)"`)
  })

  test('regexp', () => {
    expect(pi(/test/gi)).toMatchInlineSnapshot(`"/test/gi"`)
    expect(li(/test/gi)).toMatchInlineSnapshot(`"/test/gi"`)
  })

  test('date', () => {
    expect(pi(new Date(10e11))).toMatchInlineSnapshot(`"2001-09-09T01:46:40.000Z"`)
    expect(li(new Date(10e11))).toMatchInlineSnapshot(`"2001-09-09T01:46:40.000Z"`)
  })

  // -- functions --

  test('named function', () => {
    function myFn() {}
    expect(pi(myFn)).toMatchInlineSnapshot(`"[Function myFn]"`)
    expect(li(myFn)).toMatchInlineSnapshot(`"[Function myFn]"`)
  })

  test('anonymous function', () => {
    expect(pi(() => {})).toMatchInlineSnapshot(`"[Function anonymous]"`)
    expect(li(() => {})).toMatchInlineSnapshot(`"[Function]"`)
  })

  test('async function', () => {
    async function asyncFn() {}
    expect(pi(asyncFn)).toMatchInlineSnapshot(`"[Function asyncFn]"`)
    expect(li(asyncFn)).toMatchInlineSnapshot(`"[AsyncFunction asyncFn]"`)
  })

  test('generator function', () => {
    function* genFn() { yield 1 }
    expect(pi(genFn)).toMatchInlineSnapshot(`"[Function genFn]"`)
    expect(li(genFn)).toMatchInlineSnapshot(`"[GeneratorFunction genFn]"`)
  })

  // -- collections --

  test('empty object / array', () => {
    expect(pi({})).toMatchInlineSnapshot(`"{}"`)
    expect(li({})).toMatchInlineSnapshot(`"{}"`)
    expect(pi([])).toMatchInlineSnapshot(`"[]"`)
    expect(li([])).toMatchInlineSnapshot(`"[]"`)
  })

  test('array with items', () => {
    expect(pi([1, 2, 3])).toMatchInlineSnapshot(`"[ 1, 2, 3 ]"`)
    expect(li([1, 2, 3])).toMatchInlineSnapshot(`"[ 1, 2, 3 ]"`)
  })

  test('object with properties', () => {
    expect(pi({ a: 1, b: 2 })).toMatchInlineSnapshot(`"{ a: 1, b: 2 }"`)
    expect(li({ a: 1, b: 2 })).toMatchInlineSnapshot(`"{ a: 1, b: 2 }"`)
  })

  test('nested object', () => {
    expect(pi({ a: { b: { c: 1 } } })).toMatchInlineSnapshot(`"{ a: { b: { c: 1 } } }"`)
    expect(li({ a: { b: { c: 1 } } })).toMatchInlineSnapshot(`"{ a: { b: { c: 1 } } }"`)
  })

  test('Map', () => {
    const m = new Map([['a', 1]])
    expect(pi(m)).toMatchInlineSnapshot(`"Map { 'a' => 1 }"`)
    expect(li(m)).toMatchInlineSnapshot(`"Map{ 'a' => 1 }"`)
  })

  test('Set', () => {
    const s = new Set([1, 2])
    expect(pi(s)).toMatchInlineSnapshot(`"Set { 1, 2 }"`)
    expect(li(s)).toMatchInlineSnapshot(`"Set{ 1, 2 }"`)
  })

  // -- special --

  test('Error', () => {
    expect(pi(new Error('boom'))).toMatchInlineSnapshot(`"[Error: boom]"`)
    expect(li(new Error('boom'))).toMatchInlineSnapshot(`"Error: boom"`)
  })

  test('WeakMap', () => {
    expect(pi(new WeakMap())).toMatchInlineSnapshot(`"WeakMap {}"`)
    expect(li(new WeakMap())).toMatchInlineSnapshot(`"WeakMap{…}"`)
  })

  test('WeakSet', () => {
    expect(pi(new WeakSet())).toMatchInlineSnapshot(`"WeakSet {}"`)
    expect(li(new WeakSet())).toMatchInlineSnapshot(`"WeakSet{…}"`)
  })

  test('Promise', () => {
    expect(pi(Promise.resolve())).toMatchInlineSnapshot(`"{}"`)
    expect(li(Promise.resolve())).toMatchInlineSnapshot(`"Promise{…}"`)
  })
})
