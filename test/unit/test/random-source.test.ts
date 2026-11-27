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

  test('int() gives each integer the same chance', () => {
    const random = createRandomSource(RUN_SEED)
    const counts = countValues(60_000, () => random.int(1, 6))
    expect([...counts.keys()].sort()).toEqual([1, 2, 3, 4, 5, 6])
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(9_500)
      expect(count).toBeLessThan(10_500)
    }
    expect(createRandomSource(RUN_SEED).int(0, 9)).toBe(
      createRandomSource(RUN_SEED).pick([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
    )
  })

  test('int() with `edgeCases` returns an edge case in 1 of 16 calls, for each size of the range', () => {
    const random = createRandomSource(RUN_SEED)
    const counts = countValues(64_000, () => random.int(1, 6, { edgeCases: true }))
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

    const { MIN_SAFE_INTEGER: lowest, MAX_SAFE_INTEGER: highest } = Number
    const ranges = [
      [0, 2 ** 31 - 1],
      [-(2 ** 31), 2 ** 31 - 1],
      [lowest, highest],
    ]
    for (const [min, max] of ranges) {
      const edges = new Set([min, max, 0, 1, -1])
      let count = 0
      for (let i = 0; i < 64_000; i++) {
        count += edges.has(random.int(min, max, { edgeCases: true })) ? 1 : 0
      }
      expect(count).toBeGreaterThan(3_700)
      expect(count).toBeLessThan(4_300)
    }
  })

  test('int() orders the integers by their distance from 0', () => {
    const indexes = (min: number, max: number) => {
      const bucket = Math.floor(2 ** 32 / (max - min + 1))
      return Array.from({ length: max - min + 1 }, (_, index) =>
        replay([index * bucket]).int(min, max),
      )
    }
    expect(indexes(-3, 5)).toEqual([0, 1, -1, 2, -2, 3, -3, 4, 5])
    expect(indexes(-5, 2)).toEqual([0, 1, -1, 2, -2, -3, -4, -5])
    expect(indexes(3, 6)).toEqual([3, 4, 5, 6])
    expect(indexes(-6, -3)).toEqual([-3, -4, -5, -6])
    expect(Object.is(replay([0]).int(-5, -0), 0)).toBe(true)
  })

  test('int() and float() with `edgeCases` return edge cases for the top raw values, ordered by their distance from 0', () => {
    const options = { edgeCases: true }
    const edges = (count: number, read: (random: ReturnType<typeof replay>) => number) =>
      Array.from({ length: count }, (_, index) =>
        read(replay([EDGE_START + Math.ceil((index * 2 ** 28) / count)])),
      )
    expect(edges(5, (random) => random.int(-3, 5, options))).toEqual([0, 1, -1, -3, 5])
    expect(edges(2, (random) => random.int(1, 6, options))).toEqual([1, 6])
    expect(edges(3, (random) => random.float(-2, 3, options))).toEqual([0, -2, 2.9999999999999996])
    expect(edges(2, (random) => random.float(0, 1, options))).toEqual([0, 0.9999999999999999])
    expect(edges(2, (random) => random.float(-10, -1, options))).toEqual([-1.0000000000000002, -10])
    // the first raw value of `int` selects the edge case, and the second one the integer
    expect(replay([EDGE_START - 1, 0]).int(1, 6, options)).toBe(1)
    expect(replay([0, 2 ** 32 - 5]).int(1, 6, options)).toBe(6)
    expect(replay([EDGE_START, 2 ** 31]).int(1, 6, options)).toBe(1)
    // without the option, the top raw values give the same results as the other raw values
    expect(replay([EDGE_START]).int(0, 2)).toBe(2)
    expect(replay([EDGE_START]).int(0, 2 ** 32 - 1)).toBe(EDGE_START)
    expect(replay([EDGE_START]).float(0, 1)).toBe(15 / 16)
    expect(replay([EDGE_START]).pick(['leader', 'follower', 'candidate'])).toBe('candidate')
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
  })

  test('int() supports each range of safe integers, with 2 raw values above 2^32 values', () => {
    const { MIN_SAFE_INTEGER: lowest, MAX_SAFE_INTEGER: highest } = Number
    const now = Date.UTC(2026, 10, 23)
    // raw values of 0 give the integer nearest to 0
    expect(replay([]).int(0, now)).toBe(0)
    expect(replay([]).int(1e12, 2e12)).toBe(1e12)
    expect(replay([]).int(-2e12, -1e12)).toBe(-1e12)
    expect(replay([]).int(lowest, highest)).toBe(0)
    // the full range has 1024 raw values for each integer, in the order 0, 1, -1, 2, -2
    expect(replay([0, 1023]).int(lowest, highest)).toBe(0)
    expect(replay([0, 1024]).int(lowest, highest)).toBe(1)
    expect(replay([0, 2048]).int(lowest, highest)).toBe(-1)
    expect(replay([1, 0]).int(lowest, highest)).toBe(-(2 ** 21))
    expect(replay([2 ** 32 - 1, 2 ** 32 - 2049]).int(lowest, highest)).toBe(highest)
    expect(replay([2 ** 32 - 1, 2 ** 32 - 1025]).int(lowest, highest)).toBe(lowest)
    // the last raw values have no full group of 1024, so they are drawn again
    expect(replay([2 ** 32 - 1, 2 ** 32 - 1]).int(lowest, highest)).toBe(0)

    const random = createRandomSource(RUN_SEED)
    let aboveUint32 = 0
    for (let i = 0; i < 1_000; i++) {
      const value = random.int(0, now)
      expect(Number.isSafeInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(now)
      aboveUint32 += value > 2 ** 32 ? 1 : 0
    }
    // 2^32 is 0.2% of the range
    expect(aboveUint32).toBeGreaterThan(990)
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

  test('int() and float() reject an `edgeCases` option that is not a boolean', () => {
    const random = createRandomSource(RUN_SEED)
    // @ts-expect-error the option is a boolean
    expect(() => random.int(0, 1, { edgeCases: 'yes' })).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: random.int() expects a boolean "edgeCases" option, received "yes".]`,
    )
    // @ts-expect-error the option is a boolean
    expect(() => random.float(0, 1, { edgeCases: 1 })).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: random.float() expects a boolean "edgeCases" option, received 1.]`,
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
    // 2/5 of the calls
    for (const count of [negative, nearZero]) {
      expect(count).toBeGreaterThan(25_100)
      expect(count).toBeLessThan(26_100)
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
    expect(replay([2 ** 32 - 1, 0]).float(-2, 3)).toBeGreaterThan(2.99)
    expect(replay([2 ** 32 - 1, 0]).float(-3, 2)).toBeLessThan(-2.99)
  })

  test('float() of a range below 0 starts at the float nearest to 0', () => {
    // `max` is not a possible result
    expect(replay([]).float(-10, -1)).toBe(-1.0000000000000002)
    expect(replay([]).float(-10, 0)).toBe(-Number.MIN_VALUE)
    const small = replay([2 ** 10, 0]).float(-10, -1)
    expect(small).toBeLessThan(-1.0000000000000002)
    expect(replay([2 ** 20, 0]).float(-10, -1)).toBeLessThan(small)
    expect(replay([2 ** 32 - 1, 2 ** 32 - 1]).float(-10, -1)).toBeLessThan(-9.99)

    const random = createRandomSource(RUN_SEED)
    for (const edgeCases of [false, true]) {
      for (let i = 0; i < 1_000; i++) {
        const value = random.float(-10, -1, { edgeCases })
        expect(value).toBeGreaterThanOrEqual(-10)
        expect(value).toBeLessThan(-1)
      }
    }
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
    // each probability is exact: the next raw value decides while the bits are equal
    expect(replay([2 ** 32 - 1, 2 ** 32 - 1]).bool(2 ** -40)).toBe(true)
    expect(replay([2 ** 32 - 1, 2 ** 32 - 2 ** 24 - 1]).bool(2 ** -40)).toBe(false)
    expect(replay([2 ** 32 - 2]).bool(2 ** -40)).toBe(false)
    expect(replay(Array.from({ length: 34 }, () => 2 ** 32 - 1)).bool(Number.MIN_VALUE)).toBe(true)
    expect(replay(Array.from({ length: 33 }, () => 2 ** 32 - 1)).bool(Number.MIN_VALUE)).toBe(false)
    // 1 raw value decides the result of almost every call
    let reads = 0
    const counted = createRandomSource(RUN_SEED)
    const { uint32 } = counted
    counted.uint32 = () => {
      reads++
      return uint32()
    }
    for (let i = 0; i < 1000; i++) {
      counted.bool(0.3)
    }
    expect(reads).toBe(1000)
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
  })
})

test('a label must be a string', () => {
  const random = createRandomSource(RUN_SEED)
  // @ts-expect-error a number is not a label
  expect(() => random.fork(1)).toThrowErrorMatchingInlineSnapshot(
    `[TypeError: random.fork() expects a string label, received number.]`,
  )
  // @ts-expect-error an object is not a label
  expect(() => random.fork({ id: 7 })).toThrowErrorMatchingInlineSnapshot(
    `[TypeError: random.fork() expects a string label, received object.]`,
  )
  // @ts-expect-error null is not a label
  expect(() => random.fork(null)).toThrowErrorMatchingInlineSnapshot(
    `[TypeError: random.fork() expects a string label, received null.]`,
  )
})
