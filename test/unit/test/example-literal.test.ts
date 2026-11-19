import { runInNewContext } from 'node:vm'
import { describe, expect, test } from 'vitest'
import {
  createExampleArray,
  createExampleNode,
  createExampleObject,
  formatExampleNode,
  formatExamplePath,
  getExampleNodeWidth,
} from '../../../packages/vitest/src/utils/example-literal'

function formatExampleValue(value: unknown, width?: number): string | undefined {
  const node = createExampleNode(value)
  return node === undefined ? undefined : formatExampleNode(node, width)
}

// the literal creates a value that is equal to the original
function roundTrip(value: unknown, width?: number): unknown {
  const literal = formatExampleValue(value, width)
  if (literal === undefined) {
    throw new Error('The value has no literal.')
  }
  // oxlint-disable-next-line no-new-func
  return new Function(`return (${literal})`)()
}

describe('formatExampleValue', () => {
  test('numbers keep -0, NaN and Infinity', () => {
    expect([0, -0, 1.5, -2, 1e21, Number.NaN, Infinity, -Infinity].map(formatExampleValue))
      .toMatchInlineSnapshot(`
        [
          "0",
          "-0",
          "1.5",
          "-2",
          "1e+21",
          "NaN",
          "Infinity",
          "-Infinity",
        ]
      `)
  })

  test('strings escape quotes, backslashes and control characters', () => {
    const text = `it's "a" \\ test\n\u0000\t`
    expect(formatExampleValue(text)).toMatchInlineSnapshot(`"'it\\'s "a" \\\\ test\\n\\u0000\\t'"`)
    expect(roundTrip(text)).toBe(text)
  })

  test('other primitive values', () => {
    expect([true, null, undefined, 10n].map(formatExampleValue)).toEqual([
      'true',
      'null',
      'undefined',
      '10n',
    ])
  })

  test('arrays keep their holes', () => {
    // oxlint-disable-next-line no-sparse-arrays
    const sparse = [1, , 3, ,]
    expect(formatExampleValue(sparse)).toBe('[1, , 3, ,]')
    const copy = roundTrip(sparse) as unknown[]
    expect(copy).toHaveLength(4)
    expect(Object.keys(copy)).toEqual(['0', '2'])
    expect(formatExampleValue([])).toBe('[]')
  })

  test('plain objects quote keys that are not names', () => {
    const value = { name: 'Alice', 'first-name': 'A', 0: 'zero', $id: 1 }
    expect(formatExampleValue(value)).toMatchInlineSnapshot(
      `"{ 0: 'zero', name: 'Alice', 'first-name': 'A', $id: 1 }"`,
    )
    expect(roundTrip(value)).toEqual(value)
    expect(formatExampleValue({})).toBe('{}')
  })

  test('an object without a prototype keeps it', () => {
    const value = Object.assign(Object.create(null), { a: 1 })
    expect(formatExampleValue(value)).toBe('{ __proto__: null, a: 1 }')
    expect(Object.getPrototypeOf(roundTrip(value))).toBe(null)
  })

  test('maps, sets, dates and typed arrays', () => {
    const value = {
      map: new Map([['a', [1]]]),
      set: new Set([1, 2]),
      empty: new Map(),
      date: new Date(0),
      invalid: new Date(Number.NaN),
      bytes: new Uint8Array([1, 2]),
      floats: new Float64Array([-0, 0.5]),
      big: new BigInt64Array([-1n]),
    }
    expect(formatExampleValue(value)).toMatchInlineSnapshot(
      `"{ map: new Map([['a', [1]]]), set: new Set([1, 2]), empty: new Map(), date: new Date('1970-01-01T00:00:00.000Z'), invalid: new Date(NaN), bytes: new Uint8Array([1, 2]), floats: new Float64Array([-0, 0.5]), big: new BigInt64Array([-1n]) }"`,
    )
    expect(roundTrip(value)).toEqual(value)
  })

  test('values from another realm', () => {
    const value = runInNewContext(`({ list: [1, { a: new Map([[1, 2]]) }], at: new Date(0) })`)
    expect(formatExampleValue(value)).toBe(
      `{ list: [1, { a: new Map([[1, 2]]) }], at: new Date('1970-01-01T00:00:00.000Z') }`,
    )
  })

  test('values without a literal', () => {
    class Point {
      x = 1
    }
    class Items extends Array {}
    class Bytes extends Uint8Array {}
    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    const withGetter = Object.defineProperty({}, 'a', { get: () => 1, enumerable: true })
    const hidden = Object.defineProperty({}, 'a', { value: 1, enumerable: false })
    const withExtraKey = Object.assign([1], { extra: true })
    const fakeMap = { [Symbol.toStringTag]: 'Map' }
    const values = [
      new Point(),
      Items.from([1]),
      new Bytes(2),
      () => {},
      Symbol('a'),
      cycle,
      withGetter,
      hidden,
      withExtraKey,
      fakeMap,
      { [Symbol('key')]: 1 },
      JSON.parse('{"__proto__": 1}'),
      Object.create(Object.create(null)),
      new Error('error'),
      /regexp/,
      { nested: [new Point()] },
    ]
    expect(values.map(formatExampleValue)).toEqual(values.map(() => undefined))
  })

  test('an object that is used 2 times without a cycle', () => {
    const shared = { a: 1 }
    expect(formatExampleValue([shared, shared])).toBe('[{ a: 1 }, { a: 1 }]')
  })
})

describe('createExampleNode with a maximum width', () => {
  test('a literal that fits is the same as without a maximum width', () => {
    const values = [
      { name: 'Alice', roles: ['admin', 'owner'], at: new Date(0) },
      // oxlint-disable-next-line no-sparse-arrays
      [1, , 3, ,],
      new Map([['a', new Set([1n, -0])]]),
      new Uint8Array([1, 2, 3]),
      Object.assign(Object.create(null), { 'first-name': "it's" }),
    ]
    for (const value of values) {
      const node = createExampleNode(value)!
      const width = getExampleNodeWidth(node)
      expect(createExampleNode(value, width)).toEqual(node)
      expect(createExampleNode(value, width - 1)).toBeUndefined()
    }
  })

  test('a large value has no literal', () => {
    const holes: unknown[] = []
    holes.length = 10_000_000
    const values = [
      'x'.repeat(1_000_000),
      Array.from({ length: 1_000_000 }, (_, i) => i),
      holes,
      new Map(Array.from({ length: 100_000 }, (_, i) => [i, i])),
      new Set(Array.from({ length: 100_000 }, (_, i) => i)),
      new Float64Array(1_000_000),
      { list: Array.from({ length: 1_000_000 }, (_, i) => i) },
    ]
    expect(values.map((value) => createExampleNode(value, 1000))).toEqual(
      values.map(() => undefined),
    )
  })

  test('stops reading a large array at the maximum width', () => {
    let reads = 0
    const items = new Proxy(
      Array.from({ length: 1_000_000 }, (_, i) => i),
      {
        getOwnPropertyDescriptor(target, key) {
          reads++
          return Reflect.getOwnPropertyDescriptor(target, key)
        },
      },
    )
    expect(createExampleNode(items, 100)).toBeUndefined()
    expect(reads).toBeLessThan(100)
  })
})

describe('formatExampleNode', () => {
  const user = { name: 'Alice', roles: ['admin', 'owner'] }

  test('a value that fits has 1 line', () => {
    expect(formatExampleValue(user, 44)).toBe(`{ name: 'Alice', roles: ['admin', 'owner'] }`)
  })

  test('a value that does not fit breaks, and each item gets the same check', () => {
    expect(formatExampleValue({ user, active: true }, 40)).toBe(
      [
        '{',
        '  user: {',
        "    name: 'Alice',",
        "    roles: ['admin', 'owner'],",
        '  },',
        '  active: true,',
        '}',
      ].join('\n'),
    )
  })

  test('the start column and the characters after the value count', () => {
    const node = createExampleNode(user)!
    const lines = (start: number, end: number) =>
      formatExampleNode(node, 44, start, end).split('\n').length
    expect([lines(0, 0), lines(1, 0), lines(0, 1)]).toEqual([1, 4, 4])
  })

  test('an array of numbers puts as many numbers on a line as fit', () => {
    const numbers = Array.from({ length: 20 }, (_, i) => (i % 2 ? -i : i * 100))
    expect(formatExampleValue({ numbers, names: ['alice', 'bob', 'carol'] }, 30)).toBe(
      [
        '{',
        '  numbers: [',
        '    0, -1, 200, -3, 400, -5,',
        '    600, -7, 800, -9, 1000,',
        '    -11, 1200, -13, 1400, -15,',
        '    1600, -17, 1800, -19,',
        '  ],',
        '  names: [',
        "    'alice',",
        "    'bob',",
        "    'carol',",
        '  ],',
        '}',
      ].join('\n'),
    )
    expect(roundTrip(numbers, 30)).toEqual(numbers)
    expect(formatExampleValue([1n, 2n, 3n], 6)).toBe('[\n  1n,\n  2n,\n  3n,\n]')
    expect(formatExampleValue([1, Number.NaN, 3], 6)).toBe('[\n  1,\n  NaN,\n  3,\n]')
  })

  test('maps, sets and typed arrays keep their array on the first line', () => {
    const value = {
      map: new Map([
        ['alice', { admin: true }],
        ['bob', { admin: false }],
      ]),
      set: new Set(['alice', 'bob', 'carol']),
      bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
    }
    const text = formatExampleValue(value, 32)
    expect(text).toBe(
      [
        '{',
        '  map: new Map([',
        "    ['alice', { admin: true }],",
        "    ['bob', { admin: false }],",
        '  ]),',
        '  set: new Set([',
        "    'alice',",
        "    'bob',",
        "    'carol',",
        '  ]),',
        '  bytes: new Uint8Array([',
        '    1, 2, 3, 4, 5, 6, 7, 8,',
        '  ]),',
        '}',
      ].join('\n'),
    )
    expect(roundTrip(value, 32)).toEqual(value)
  })

  test('a long string stays on 1 line', () => {
    const value = { id: 1, text: 'x'.repeat(30) }
    expect(formatExampleValue(value, 20)).toBe(`{\n  id: 1,\n  text: '${'x'.repeat(30)}',\n}`)
  })

  test('an array with holes keeps them on more lines', () => {
    // oxlint-disable-next-line no-sparse-arrays
    const sparse = [100, , 300, ,]
    expect(formatExampleValue(sparse, 10)).toBe('[\n  100,\n  ,\n  300,\n  ,\n]')
    const copy = roundTrip(sparse, 10) as unknown[]
    expect(copy).toHaveLength(4)
    expect(Object.keys(copy)).toEqual(['0', '2'])
  })

  test('an entry of the `examples` option', () => {
    const node = (value: unknown) => createExampleNode(value)!
    const entry = createExampleObject([
      ['network', createExampleObject([['delay', node(51)]])],
      [
        '$node',
        createExampleArray([
          node({ name: 'a', timeout: 150 }),
          node({ name: 'b', timeout: 150 }),
          node({ name: 'c', timeout: 150 }),
        ]),
      ],
      ['@scope/pkg', createExampleObject([['id', node('x')]])],
    ])
    expect(formatExampleNode(entry)).toBe(
      `{ network: { delay: 51 }, $node: [{ name: 'a', timeout: 150 }, { name: 'b', timeout: 150 }, { name: 'c', timeout: 150 }], '@scope/pkg': { id: 'x' } }`,
    )
    expect(`examples: [${formatExampleNode(entry, 87, 'examples: ['.length, 1)}]`).toBe(
      [
        'examples: [{',
        '  network: { delay: 51 },',
        '  $node: [',
        "    { name: 'a', timeout: 150 },",
        "    { name: 'b', timeout: 150 },",
        "    { name: 'c', timeout: 150 },",
        '  ],',
        "  '@scope/pkg': { id: 'x' },",
        '}]',
      ].join('\n'),
    )
    expect(formatExampleNode(createExampleObject([]))).toBe('{}')
  })
})

describe('formatExamplePath', () => {
  test('a key that is not an identifier is in brackets, as a JavaScript property', () => {
    expect([
      formatExamplePath(['network', 'delay']),
      formatExamplePath(['@scope/pkg', 'id']),
      formatExamplePath(['network', '$node'], 1),
      formatExamplePath(['jobs', '0', "it's"]),
    ]).toEqual(['network.delay', "['@scope/pkg'].id", 'network.$node[1]', "jobs[0]['it\\'s']"])
  })
})
