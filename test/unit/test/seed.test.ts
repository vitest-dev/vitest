import { createTestRandom, deriveSeed } from '@vitest/utils/seed'
import { describe, expect, test } from 'vitest'

const RUN_SEED = '0000000000000000'
// the first raw value of this seed is 0
const FIRST_VALUE_ZERO = 'f8364607e9c949bd'

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
    // values from the reference C code of FNV-1a 64 and splitmix64
    expect(deriveSeed(['a'])).toBe('01e4fe518082dd3e')
    expect(deriveSeed(['run', 'src/raft.test.ts', 'one leader per term'])).toBe('7f9e2a1a865fb29d')
  })

  test('the boundaries between the parts change the seed', () => {
    expect(deriveSeed([RUN_SEED, 'web', 'src/raft.test.ts'])).not.toBe(
      deriveSeed([RUN_SEED, 'websrc', '/raft.test.ts']),
    )
  })
})

describe('createTestRandom', () => {
  test('returns the same values in every version', () => {
    const random = createTestRandom(RUN_SEED)
    // values from the reference C code of splitmix64 and xoshiro128**
    expect(Array.from({ length: 6 }, () => random.uint32())).toEqual([
      3737715805, 2584255861, 2876756834, 3286328325, 1553311962, 1625202774,
    ])
  })

  test('next() takes 53 bits from 2 raw values', () => {
    const raw = createTestRandom(RUN_SEED)
    const high = raw.uint32() >>> 5
    const low = raw.uint32() >>> 6
    expect(createTestRandom(RUN_SEED).next()).toBe((high * 2 ** 26 + low) / 2 ** 53)
  })

  test('accepts upper case seeds', () => {
    const random = createTestRandom('0123456789ABCDEF')
    expect(random.seed).toBe('0123456789abcdef')
    expect(random.uint32()).toBe(createTestRandom('0123456789abcdef').uint32())
  })

  test('rejects seeds that are not 16 hexadecimal digits', () => {
    expect(() => createTestRandom('1234')).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: The seed must be 16 hexadecimal digits, received "1234".]`,
    )
    expect(() => createTestRandom('0x23456789abcdef')).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: The seed must be 16 hexadecimal digits, received "0x23456789abcdef".]`,
    )
  })

  test('int() returns each integer in the range with the same chance', () => {
    const random = createTestRandom(RUN_SEED)
    const counts = countValues(60_000, () => random.int(1, 6))
    expect([...counts.keys()].sort()).toEqual([1, 2, 3, 4, 5, 6])
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(9_500)
      expect(count).toBeLessThan(10_500)
    }
  })

  test('int() supports a range of one value and a range of 2^32 values', () => {
    expect(createTestRandom(RUN_SEED).int(7, 7)).toBe(7)
    expect(createTestRandom(RUN_SEED).int(0, 2 ** 32 - 1)).toBe(3737715805)
  })

  test('int() rejects invalid ranges', () => {
    const random = createTestRandom(RUN_SEED)
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
    const random = createTestRandom(RUN_SEED)
    for (let i = 0; i < 1_000; i++) {
      const value = random.float(-2, 3)
      expect(value).toBeGreaterThanOrEqual(-2)
      expect(value).toBeLessThan(3)
    }
    expect(() => random.float(1, Number.POSITIVE_INFINITY)).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: random.float() expects finite numbers with min <= max, received 1 and Infinity.]`,
    )
  })

  test('float() never returns max when the range is small compared to min', () => {
    const random = createTestRandom(RUN_SEED)
    // 2 ** 53 + 2 is the next float after 2 ** 53
    const values = new Set(Array.from({ length: 100 }, () => random.float(2 ** 53, 2 ** 53 + 2)))
    expect([...values]).toEqual([2 ** 53])
  })

  test('float() returns min if min equals max, and rejects a range above Number.MAX_VALUE', () => {
    const random = createTestRandom(RUN_SEED)
    expect(random.float(5, 5)).toBe(5)
    expect(() =>
      random.float(-Number.MAX_VALUE, Number.MAX_VALUE),
    ).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: random.float() supports a range of at most Number.MAX_VALUE, received -1.7976931348623157e+308 and 1.7976931348623157e+308.]`,
    )
  })

  test('bool() returns true with the given probability', () => {
    const random = createTestRandom(RUN_SEED)
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
    const random = createTestRandom(RUN_SEED)
    const nodes = ['node-1', 'node-2', 'node-3']
    const counts = countValues(3_000, () => random.pick(nodes))
    expect([...counts.keys()].sort()).toEqual(nodes)
    expect(() => random.pick([])).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: random.pick() cannot pick from an empty array.]`,
    )
  })

  test('weighted() uses the weights and never returns a value with weight 0', () => {
    const random = createTestRandom(RUN_SEED)
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
    const random = createTestRandom(RUN_SEED)
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
    const random = createTestRandom(RUN_SEED)
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
    const value = createTestRandom(RUN_SEED).uint32()
    const bytes = createTestRandom(RUN_SEED).bytes(6)
    expect(bytes).toHaveLength(6)
    expect(Array.from(bytes.subarray(0, 4))).toEqual([
      value & 0xff,
      (value >>> 8) & 0xff,
      (value >>> 16) & 0xff,
      value >>> 24,
    ])
  })

  test('uuid() returns a version 4 UUID', () => {
    const uuid = createTestRandom(RUN_SEED).uuid()
    expect(uuid).toMatchInlineSnapshot(`"5d04c9de-759d-489a-a2d3-77ab0564e1c3"`)
    expect(uuid).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/)
  })

  test('fork() does not depend on the values that the parent returned before', () => {
    const parent = createTestRandom(RUN_SEED)
    const before = parent.fork('network')
    const other = createTestRandom(RUN_SEED)
    other.int(0, 100)
    other.uuid()
    const after = other.fork('network')
    expect(after.seed).toBe(before.seed)
    expect(after.uint32()).toBe(before.uint32())
    expect(parent.fork('faults').seed).not.toBe(before.seed)
  })

  test('fork() rejects a label that the stream already used', () => {
    const random = createTestRandom(RUN_SEED)
    random.fork('network')
    expect(() => random.fork('network')).toThrowErrorMatchingInlineSnapshot(
      `[Error: random.fork("network") was already called on the stream with the seed 0000000000000000. Use a different label for each independent stream.]`,
    )
  })

  test('methods work without the object', () => {
    const { int, pick } = createTestRandom(RUN_SEED)
    const random = createTestRandom(RUN_SEED)
    expect(int(0, 100)).toBe(random.int(0, 100))
    expect(pick(['leader', 'follower'])).toBe(random.pick(['leader', 'follower']))
  })

  test('raw values of 0 give the simplest result', () => {
    expect(createTestRandom(FIRST_VALUE_ZERO).uint32()).toBe(0)

    const random = () => createTestRandom(FIRST_VALUE_ZERO)
    // the first raw value gives the high bits of next()
    expect(random().next()).toBeLessThan(2 ** -27)
    expect(random().int(5, 10)).toBe(5)
    expect(random().float(2, 3)).toBeLessThan(2 + 2 ** -27)
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
