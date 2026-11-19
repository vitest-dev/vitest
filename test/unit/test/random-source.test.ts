import { createRandomSource, deriveSeed } from '@vitest/utils/random-source'
import { describe, expect, test } from 'vitest'

const RUN_SEED = '0000000000000000'
// the first raw value of this seed is 0
const FIRST_VALUE_ZERO = 'f8364607e9c949bd'
// `int` and `float` return an edge case for raw values from here
const EDGE_START = 15 * 2 ** 28

// a source that returns these raw values, and then zeros
function replay(values: number[]) {
  const random = createRandomSource(RUN_SEED)
  let index = 0
  random.uint32 = () => values[index++] ?? 0
  return random
}

function countValues<T>(draws: number, draw: () => T): Map<T, number> {
  const counts = new Map<T, number>()
  for (let i = 0; i < draws; i++) {
    const value = draw()
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return counts
}

describe('deriveSeed', () => {
  test('returns the same seed in every version', () => {
    expect(deriveSeed(['a'])).toBe('445ab848a46dc1fc')
    expect(deriveSeed(['run', 'src/raft.test.ts', 'one leader per term'])).toBe('8c5741ed0c57a7bf')
    expect(deriveSeed(['test', 'src/i18n.test.ts', 'formats 日本語 and 😀'])).toBe(
      '7a2276ae25ed5e1c',
    )
    // a part longer than 2^16 code units
    expect(deriveSeed([JSON.stringify(Array.from({ length: 20_000 }, (_, i) => i))])).toBe(
      '3736a417c392b1fc',
    )
  })

  test('the boundaries between the parts change the seed', () => {
    expect(deriveSeed([RUN_SEED, 'web', 'src/raft.test.ts'])).not.toBe(
      deriveSeed([RUN_SEED, 'websrc', '/raft.test.ts']),
    )
  })
})

describe('createRandomSource', () => {
  test('returns the same values in every version', () => {
    const random = createRandomSource(RUN_SEED)
    // values from the reference C code of splitmix64 and xoshiro128**
    expect(Array.from({ length: 6 }, () => random.uint32())).toEqual([
      3737715805, 2584255861, 2876756834, 3286328325, 1553311962, 1625202774,
    ])
  })

  test('next() takes 53 bits from 2 raw values', () => {
    const raw = createRandomSource(RUN_SEED)
    const high = raw.uint32() >>> 5
    const low = raw.uint32() >>> 6
    expect(createRandomSource(RUN_SEED).next()).toBe((high * 2 ** 26 + low) / 2 ** 53)
  })

  test('accepts upper case seeds', () => {
    const random = createRandomSource('0123456789ABCDEF')
    expect(random.seed).toBe('0123456789abcdef')
    expect(random.uint32()).toBe(createRandomSource('0123456789abcdef').uint32())
  })

  test('rejects seeds that are not 16 hexadecimal digits', () => {
    expect(() => createRandomSource('1234')).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: The seed must be 16 hexadecimal digits, received "1234".]`,
    )
    expect(() => createRandomSource('0x23456789abcdef')).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: The seed must be 16 hexadecimal digits, received "0x23456789abcdef".]`,
    )
  })

  test('int() returns an edge case in 1 of 16 calls, and the other integers with the same chance', () => {
    const random = createRandomSource(RUN_SEED)
    const counts = countValues(64_000, () => random.int(1, 6))
    expect([...counts.keys()].sort()).toEqual([1, 2, 3, 4, 5, 6])
    // 1 and 6 are the edge cases: (15/16) / 6 + (1/16) / 2 of the calls
    for (const edge of [1, 6]) {
      expect(counts.get(edge)).toBeGreaterThan(11_500)
      expect(counts.get(edge)).toBeLessThan(12_500)
    }
    for (const value of [2, 3, 4, 5]) {
      expect(counts.get(value)).toBeGreaterThan(9_500)
      expect(counts.get(value)).toBeLessThan(10_500)
    }
  })

  test('int() orders the integers by their distance from 0', () => {
    const indexes = (min: number, max: number) => {
      const bucket = Math.floor(EDGE_START / (max - min + 1))
      return Array.from({ length: max - min + 1 }, (_, index) =>
        replay([index * bucket]).int(min, max),
      )
    }
    expect(indexes(-3, 5)).toEqual([0, 1, -1, 2, -2, 3, -3, 4, 5])
    expect(indexes(-5, 2)).toEqual([0, 1, -1, 2, -2, -3, -4, -5])
    expect(indexes(3, 6)).toEqual([3, 4, 5, 6])
    expect(indexes(-6, -3)).toEqual([-3, -4, -5, -6])
  })

  test('int() and float() return edge cases for the top raw values, ordered by their distance from 0', () => {
    const edges = (count: number, read: (random: ReturnType<typeof replay>) => number) =>
      Array.from({ length: count }, (_, index) =>
        read(replay([EDGE_START + Math.ceil((index * 2 ** 28) / count)])),
      )
    expect(edges(5, (random) => random.int(-3, 5))).toEqual([0, 1, -1, -3, 5])
    expect(edges(2, (random) => random.int(1, 6))).toEqual([1, 6])
    expect(edges(3, (random) => random.float(-2, 3))).toEqual([0, -2, 2.9999999999999996])
    expect(edges(2, (random) => random.float(0, 1))).toEqual([0, 0.9999999999999999])
    expect(edges(2, (random) => random.float(-10, -1))).toEqual([-1.0000000000000002, -10])
    // the other methods have no edge cases
    expect(replay([EDGE_START]).pick(['leader', 'follower', 'candidate'])).toBe('candidate')
    // a range that needs almost all raw values has no edge cases
    expect(replay([EDGE_START]).int(0, 2 ** 32 - 1)).toBe(EDGE_START)
  })

  test('int() supports a range of one value and a range of 2^32 values', () => {
    expect(createRandomSource(RUN_SEED).int(7, 7)).toBe(7)
    expect(createRandomSource(RUN_SEED).int(0, 2 ** 32 - 1)).toBe(3737715805)
  })

  test('int() rejects invalid ranges', () => {
    const random = createRandomSource(RUN_SEED)
    expect(() => random.int(1.5, 2)).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: random.int() expects safe integers with min <= max, received 1.5 and 2.]`,
    )
    expect(() => random.int(3, 1)).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: random.int() expects safe integers with min <= max, received 3 and 1.]`,
    )
    expect(() => random.int(0, 2 ** 32)).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: random.int() supports at most 2^32 values between min and max, received 4294967297.]`,
    )
  })

  test('float() returns values in [min, max)', () => {
    const random = createRandomSource(RUN_SEED)
    for (let i = 0; i < 1_000; i++) {
      const value = random.float(-2, 3)
      expect(value).toBeGreaterThanOrEqual(-2)
      expect(value).toBeLessThan(3)
    }
    expect(() => random.float(1, Number.POSITIVE_INFINITY)).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: random.float() expects finite numbers with min <= max, received 1 and Infinity.]`,
    )
    // @ts-expect-error the range is required
    expect(() => random.float()).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: random.float() expects finite numbers with min <= max, received undefined and undefined.]`,
    )
  })

  test('int() and float() with `uniform` have no edge cases, and keep the order from 0', () => {
    const random = createRandomSource(RUN_SEED)
    const counts = countValues(60_000, () => random.int(1, 6, { uniform: true }))
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(9_500)
      expect(count).toBeLessThan(10_500)
    }
    // the raw values from EDGE_START give integers, as for `pick`
    expect(replay([EDGE_START]).int(0, 2, { uniform: true })).toBe(2)
    expect(replay([EDGE_START]).int(0, 2)).toBe(0)
    expect(replay([EDGE_START]).float(0, 1, { uniform: true })).toBe(15 / 16)
    expect(createRandomSource(RUN_SEED).int(0, 9, { uniform: true })).toBe(
      createRandomSource(RUN_SEED).pick([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
    )
    const bucket = Math.floor(2 ** 32 / 9)
    expect(
      Array.from({ length: 9 }, (_, index) =>
        replay([index * bucket]).int(-3, 5, { uniform: true }),
      ),
    ).toEqual([0, 1, -1, 2, -2, 3, -3, 4, 5])
    expect(replay([2 ** 20, 2 ** 6]).float(-2, 3, { uniform: true })).toBeLessThan(0)
    expect(replay([]).float(-2, 3, { uniform: true })).toBe(0)
  })

  test('int() and float() reject a `uniform` option that is not a boolean', () => {
    const random = createRandomSource(RUN_SEED)
    // @ts-expect-error the option is a boolean
    expect(() => random.int(0, 1, { uniform: 'yes' })).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: random.int() expects a boolean "uniform" option, received "yes".]`,
    )
    // @ts-expect-error the option is a boolean
    expect(() => random.float(0, 1, { uniform: 1 })).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: random.float() expects a boolean "uniform" option, received 1.]`,
    )
  })

  test('float() returns values below 0 as often as values above 0 at the same distance', () => {
    const random = createRandomSource(RUN_SEED)
    let negative = 0
    let nearZero = 0
    for (let i = 0; i < 64_000; i++) {
      const value = random.float(-2, 3)
      if (value < 0) {
        negative++
      }
      if (value > -1 && value < 1) {
        nearZero++
      }
    }
    // (15/16) * (2/5) of the calls, and 1 edge case (-2 or 0) in (1/16) / 3 of the calls
    for (const count of [negative, nearZero]) {
      expect(count).toBeGreaterThan(24_800)
      expect(count).toBeLessThan(25_900)
    }
  })

  test('float() orders the floats by their distance from 0, with the sign in the lowest bit', () => {
    // the high 27 bits of the index come from the first raw value, the low 26 bits from bit 6
    // of the second raw value
    expect(replay([]).float(-2, 3)).toBe(0)
    expect(Object.is(replay([0, 2 ** 6]).float(-2, 3), 0)).toBe(true)
    const small = replay([2 ** 10, 0]).float(-2, 3)
    expect(small).toBeGreaterThan(0)
    expect(replay([2 ** 10, 2 ** 6]).float(-2, 3)).toBe(-small)
    expect(replay([2 ** 20, 0]).float(-2, 3)).toBeGreaterThan(small)
    // only the larger side has the distances above 2
    expect(replay([EDGE_START - 1, 0]).float(-2, 3)).toBeGreaterThan(2.99)
    expect(replay([EDGE_START - 1, 0]).float(-3, 2)).toBeLessThan(-2.99)
  })

  test('float() never returns max when the range is small compared to min', () => {
    const random = createRandomSource(RUN_SEED)
    // 2 ** 53 + 2 is the next float after 2 ** 53
    const values = new Set(Array.from({ length: 100 }, () => random.float(2 ** 53, 2 ** 53 + 2)))
    expect([...values]).toEqual([2 ** 53])
  })

  test('float() returns min if min equals max, and rejects a range above Number.MAX_VALUE', () => {
    const random = createRandomSource(RUN_SEED)
    expect(random.float(5, 5)).toBe(5)
    expect(() =>
      random.float(-Number.MAX_VALUE, Number.MAX_VALUE),
    ).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: random.float() supports a range of at most Number.MAX_VALUE, received -1.7976931348623157e+308 and 1.7976931348623157e+308.]`,
    )
  })

  test('bool() returns true with the given probability', () => {
    const random = createRandomSource(RUN_SEED)
    expect(countValues(1_000, () => random.bool(0))).toEqual(new Map([[false, 1_000]]))
    expect(countValues(1_000, () => random.bool(1))).toEqual(new Map([[true, 1_000]]))
    const trueCount = countValues(10_000, () => random.bool(0.25)).get(true)
    expect(trueCount).toBeGreaterThan(2_350)
    expect(trueCount).toBeLessThan(2_650)
    expect(() => random.bool(1.5)).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: random.bool() expects a probability between 0 and 1, received 1.5.]`,
    )
    expect(() => random.bool(Number.NaN)).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: random.bool() expects a probability between 0 and 1, received NaN.]`,
    )
  })

  test('pick() returns an item of the array', () => {
    const random = createRandomSource(RUN_SEED)
    const nodes = ['node-1', 'node-2', 'node-3']
    const counts = countValues(3_000, () => random.pick(nodes))
    expect([...counts.keys()].sort()).toEqual(nodes)
    expect(() => random.pick([])).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: random.pick() cannot pick from an empty array.]`,
    )
  })

  test('weighted() uses the weights and never returns a value with weight 0', () => {
    const random = createRandomSource(RUN_SEED)
    const counts = countValues(10_000, () =>
      random.weighted([
        ['deliver', 8],
        ['drop', 0],
        ['delay', 2],
      ]),
    )
    expect(counts.has('drop')).toBe(false)
    expect(counts.get('deliver')).toBeGreaterThan(7_850)
    expect(counts.get('deliver')).toBeLessThan(8_150)
    expect(() => random.weighted([['drop', 0]])).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: random.weighted() needs at least one weight above 0.]`,
    )
    expect(() => random.weighted([['drop', -1]])).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: random.weighted() expects finite weights that are 0 or more, received -1.]`,
    )
    expect(() =>
      random.weighted([
        ['deliver', Number.MAX_VALUE],
        ['delay', Number.MAX_VALUE],
      ]),
    ).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: random.weighted() supports a sum of weights of at most Number.MAX_VALUE.]`,
    )
  })

  test('shuffle() returns a shuffled copy', () => {
    const random = createRandomSource(RUN_SEED)
    const messages = ['append', 'commit', 'heartbeat', 'vote', 'snapshot']
    const shuffled = random.shuffle(messages)
    expect(shuffled).toMatchInlineSnapshot(`
      [
        "vote",
        "heartbeat",
        "snapshot",
        "commit",
        "append",
      ]
    `)
    expect([...shuffled].sort()).toEqual([...messages].sort())
    expect(messages).toEqual(['append', 'commit', 'heartbeat', 'vote', 'snapshot'])
  })

  test('sample() returns different items of the array', () => {
    const random = createRandomSource(RUN_SEED)
    const nodes = ['node-1', 'node-2', 'node-3', 'node-4', 'node-5']
    const sample = random.sample(nodes, 3)
    expect(sample).toHaveLength(3)
    expect(new Set(sample).size).toBe(3)
    expect(random.sample(nodes, 0)).toEqual([])
    expect(() => random.sample(nodes, 6)).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: random.sample() expects a count between 0 and 5, received 6.]`,
    )
  })

  test('bytes() returns the raw values in little endian order', () => {
    const value = createRandomSource(RUN_SEED).uint32()
    const bytes = createRandomSource(RUN_SEED).bytes(6)
    expect(bytes).toHaveLength(6)
    expect(Array.from(bytes.subarray(0, 4))).toEqual([
      value & 0xff,
      (value >>> 8) & 0xff,
      (value >>> 16) & 0xff,
      value >>> 24,
    ])
  })

  test('uuid() returns a version 4 UUID', () => {
    const uuid = createRandomSource(RUN_SEED).uuid()
    expect(uuid).toMatchInlineSnapshot(`"5d04c9de-759d-489a-a2d3-77ab0564e1c3"`)
    expect(uuid).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/)
  })

  test('fork() does not depend on the values that the parent returned before', () => {
    const parent = createRandomSource(RUN_SEED)
    const before = parent.fork('network')
    const other = createRandomSource(RUN_SEED)
    other.int(0, 100)
    other.uuid()
    const after = other.fork('network')
    expect(after.seed).toBe(before.seed)
    expect(after.uint32()).toBe(before.uint32())
    expect(parent.fork('faults').seed).not.toBe(before.seed)
  })

  test('fork() rejects a label that the random source already used', () => {
    const random = createRandomSource(RUN_SEED)
    random.fork('network')
    expect(() => random.fork('network')).toThrowErrorMatchingInlineSnapshot(
      `[Error: random.fork("network") was already called on the random source with the seed 0000000000000000. Use a different label for each fork.]`,
    )
  })

  test('methods work without the object', () => {
    const { int, pick } = createRandomSource(RUN_SEED)
    const random = createRandomSource(RUN_SEED)
    expect(int(0, 100)).toBe(random.int(0, 100))
    expect(pick(['leader', 'follower'])).toBe(random.pick(['leader', 'follower']))
  })

  test('raw values of 0 give the simplest result', () => {
    expect(createRandomSource(FIRST_VALUE_ZERO).uint32()).toBe(0)

    const random = () => createRandomSource(FIRST_VALUE_ZERO)
    // the first raw value gives the high bits of next()
    expect(random().next()).toBeLessThan(2 ** -27)
    expect(random().int(5, 10)).toBe(5)
    expect(random().int(-5, 10)).toBe(0)
    expect(random().int(-10, -5)).toBe(-5)
    expect(random().float(2, 3)).toBeLessThan(2 + 2 ** -27)
    expect(Math.abs(random().float(-2, 3))).toBeLessThan(2 ** -24)
    expect(random().bool(0.99)).toBe(false)
    expect(random().pick(['leader', 'follower'])).toBe('leader')
    expect(
      random().weighted([
        ['drop', 0],
        ['deliver', 1],
        ['delay', 9],
      ]),
    ).toBe('deliver')
    expect(random().sample(['leader', 'follower', 'candidate'], 1)).toEqual(['leader'])
    expect(random().shuffle(['leader', 'follower'])).toEqual(['leader', 'follower'])
    expect(Array.from(random().bytes(4))).toEqual([0, 0, 0, 0])
    expect(random().many('items', () => 'item')).toEqual([])
  })

  test('span() returns the result of the function', () => {
    const random = createRandomSource(RUN_SEED)
    const user = random.span('user', () => ({ id: random.uuid(), age: random.int(18, 99) }))
    const plain = createRandomSource(RUN_SEED)
    expect(user).toEqual({ id: plain.uuid(), age: plain.int(18, 99) })
  })

  test('span() and many() reject an async function', () => {
    const random = createRandomSource(RUN_SEED)
    expect(() => random.span('user', async () => random.uuid())).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: random.span("user") expects a function that is not async.]`,
    )
    expect(() =>
      random.many('users', async () => random.uuid(), { min: 1 }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: random.many("users") expects a function that is not async.]`,
    )
  })

  test('many() returns between min and max items with their index', () => {
    const random = createRandomSource(RUN_SEED)
    const lengths = new Set<number>()
    for (let i = 0; i < 1000; i++) {
      const items = random.many('items', (index) => index, { min: 2, max: 6 })
      expect(items).toEqual(Array.from({ length: items.length }, (_, index) => index))
      lengths.add(items.length)
    }
    expect([...lengths].sort()).toEqual([2, 3, 4, 5, 6])
  })

  test('many() returns the average count of items', () => {
    const random = createRandomSource(RUN_SEED)
    let total = 0
    for (let i = 0; i < 10_000; i++) {
      total += random.many('items', () => 'item', { min: 1, average: 4 }).length
    }
    expect(total / 10_000).toBeGreaterThan(3.9)
    expect(total / 10_000).toBeLessThan(4.1)
  })

  test('many() rejects invalid options', () => {
    const random = createRandomSource(RUN_SEED)
    expect(() =>
      random.many('items', () => 1, { min: 3, max: 2 }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: random.many("items") expects integers with 0 <= min <= max, received 3 and 2.]`,
    )
    expect(() =>
      random.many('items', () => 1, { max: 2, average: 3 }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: random.many("items") expects a finite average between 0 and 2, received 3.]`,
    )
  })

  test('many() rejects a call without a label', () => {
    const random = createRandomSource(RUN_SEED)
    // @ts-expect-error the label is missing
    expect(() => random.many(() => 1)).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: random.many() expects a label as the first argument, received function.]`,
    )
  })
})
