export interface RandomSource {
  /**
   * The seed of this random source as 16 hexadecimal digits.
   */
  readonly seed: string
  /**
   * Returns a float in `[0, 1)` with 53 random bits, like `Math.random()`.
   */
  next: () => number
  /**
   * Returns an integer in `[0, 2^32)`.
   */
  uint32: () => number
  /**
   * Returns an integer in `[min, max]`. In about 1 of 16 calls, it returns an edge case:
   * `min`, `max`, 0, 1 or -1. The other integers have the same chance.
   * @see {@link https://vitest.dev/api/random#int}
   */
  int: (min: number, max: number, options?: RandomNumberOptions) => number
  /**
   * Returns a float in `[min, max)`, or `min` if `min` equals `max`. In about 1 of 16 calls,
   * it returns an edge case: `min`, 0 or the largest float below `max`.
   * @see {@link https://vitest.dev/api/random#float}
   */
  float: (min: number, max: number, options?: RandomNumberOptions) => number
  /**
   * Returns `true` with the given probability.
   */
  bool: (probability?: number) => boolean
  /**
   * Returns one item of the array. Each item has the same chance.
   */
  pick: <T>(items: readonly T[]) => T
  /**
   * Returns one value. The chance of each value is its weight divided by the sum of all weights.
   */
  weighted: <T>(entries: readonly (readonly [value: T, weight: number])[]) => T
  /**
   * Returns a shuffled copy of the array.
   */
  shuffle: <T>(items: readonly T[]) => T[]
  /**
   * Returns `count` different items of the array in a random order.
   */
  sample: <T>(items: readonly T[], count: number) => T[]
  /**
   * Returns `length` random bytes.
   */
  bytes: (length: number) => Uint8Array
  /**
   * Returns a version 4 UUID.
   */
  uuid: () => string
  /**
   * Returns an independent random source. Its values depend only on this seed and the label,
   * not on the values that this random source returned before. Each label can be used one time:
   * a second fork with the same label would return the same values, so it throws an error.
   * @see {@link https://vitest.dev/api/random#fork}
   */
  fork: (label: string) => RandomSource
  /**
   * Returns a copy of this random source at its current position. The copy returns the same
   * values that this random source returns from now on, and it keeps the used fork labels.
   * @see {@link https://vitest.dev/api/random#clone}
   */
  clone: () => RandomSource
}

export interface RandomNumberOptions {
  /**
   * Gives each value the same chance. Without it, edge cases such as `min`, `max` and 0 are
   * more likely than the other values.
   * @default false
   */
  uniform?: boolean
}

const UINT32_RANGE = 2 ** 32
const UINT25_RANGE = 2 ** 25
const UINT26_RANGE = 2 ** 26
const UINT53_RANGE = 2 ** 53
// `int` and `float` return an edge case for the top 1/16 of the raw values
const EDGE_RANGE = 2 ** 28
const EDGE_START = UINT32_RANGE - EDGE_RANGE
// `float` takes 27 bits from the first raw value and 26 bits from the second one; without
// `uniform`, the first raw value is below EDGE_START
const FLOAT_INDEXES = (EDGE_START / 32) * UINT26_RANGE
const SEED_PATTERN = /^[\da-f]{16}$/i

let encoder: TextEncoder | undefined
let hexBytes: string[] | undefined
let floatView: DataView | undefined
// the edge cases of 1 call of `int` or `float`, reused so that a call creates no array
const edges = [0, 0, 0, 0, 0]
// Numbers are exact only up to 2^53 and BigInt is slow, so 64-bit values are two 32-bit
// halves: `high` and `low`. `mix64` and `multiply64` return their result in these variables,
// so that a call does not create an array.
let mixHigh = 0
let mixLow = 0

export function deriveSeed(parts: readonly string[]): string {
  // FNV-1a 64: for each byte, `hash = (hash ^ byte) * prime` modulo 2^64.
  // JSON keeps the boundaries between the parts, so ['ab', 'c'] and ['a', 'bc'] differ.
  let high = 0xcbf2_9ce4
  let low = 0x8422_2325
  for (const byte of (encoder ??= new TextEncoder()).encode(JSON.stringify(parts))) {
    low = (low ^ byte) >>> 0
    // The prime is 2^40 + 0x1b3. `low * 0x1b3` has at most 41 bits: its lower 32 bits are the
    // new `low`, and the rest carries into `high`. `low * 2^40` changes only `high`: `low << 8`.
    const product = low * 0x1b3
    high = (Math.imul(high, 0x1b3) + (low << 8) + Math.floor(product / UINT32_RANGE)) >>> 0
    low = product >>> 0
  }
  mix64(high, low)
  return toHex(mixHigh) + toHex(mixLow)
}

export function createRandomSource(seed: string): RandomSource {
  return new SeededRandom(seed)
}

function isUniform(options: RandomNumberOptions | undefined, method: string): boolean {
  const uniform = options?.uniform ?? false
  if (typeof uniform !== 'boolean') {
    throw new TypeError(
      `random.${method}() expects a boolean "uniform" option, received ${JSON.stringify(uniform)}.`,
    )
  }
  return uniform
}

// Each method maps raw values of 0 to its simplest result (the number nearest to 0, `false`,
// the first item, the same order), and smaller raw values to simpler results. Shrinking
// depends on it.
class SeededRandom implements RandomSource {
  readonly seed: string
  private s0: number
  private s1: number
  private s2: number
  private s3: number
  private forks: Set<string> | undefined

  constructor(seed: string) {
    if (!SEED_PATTERN.test(seed)) {
      throw new TypeError(`The seed must be 16 hexadecimal digits, received "${seed}".`)
    }
    this.seed = seed.toLowerCase()

    // splitmix64 makes the xoshiro128** state from the seed, as the authors of xoshiro recommend.
    // Each step adds 0x9e3779b9_7f4a7c15 to the 64-bit state and mixes it. The comparison
    // carries the overflow of `low` into `high`.
    let high = Number.parseInt(seed.slice(0, 8), 16)
    let low = Number.parseInt(seed.slice(8), 16) + 0x7f4a_7c15
    high = (high + 0x9e37_79b9 + (low > 0xffff_ffff ? 1 : 0)) >>> 0
    low >>>= 0
    mix64(high, low)
    this.s0 = mixLow | 0
    this.s1 = mixHigh | 0
    low += 0x7f4a_7c15
    high = (high + 0x9e37_79b9 + (low > 0xffff_ffff ? 1 : 0)) >>> 0
    low >>>= 0
    mix64(high, low)
    this.s2 = mixLow | 0
    this.s3 = mixHigh | 0
  }

  // one step of xoshiro128** (https://prng.di.unimi.it/xoshiro128starstar.c)
  uint32 = (): number => {
    const s0 = this.s0
    const s1 = this.s1
    const result = Math.imul(rotateLeft(Math.imul(s1, 5), 7), 9) >>> 0
    const t = s1 << 9
    const s2 = this.s2 ^ s0
    const s3 = this.s3 ^ s1
    this.s1 = s1 ^ s2
    this.s0 = s0 ^ s3
    this.s2 = s2 ^ t
    this.s3 = rotateLeft(s3, 11)
    return result
  }

  // 27 bits of the first raw value and 26 bits of the second one make 53 bits, as many as a
  // float can hold
  next = (): number => {
    const high = this.uint32() >>> 5
    const low = this.uint32() >>> 6
    return (high * UINT26_RANGE + low) / UINT53_RANGE
  }

  int = (min: number, max: number, options?: RandomNumberOptions): number => {
    const uniform = isUniform(options, 'int')
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) {
      throw new RangeError(
        `random.int() expects safe integers with min <= max, received ${min} and ${max}.`,
      )
    }
    const range = max - min + 1
    if (range > UINT32_RANGE) {
      throw new RangeError(
        `random.int() supports at most 2^32 values between min and max, received ${range}.`,
      )
    }
    // a range that needs almost all raw values gets no edge cases
    if (uniform || range > EDGE_START) {
      return integerAt(min, max, this.itemIndex(range))
    }
    const bucket = Math.floor(EDGE_START / range)
    const limit = bucket * range
    let value = this.uint32()
    // values above the last full bucket are drawn again, so each result has the same chance
    while (value >= limit && value < EDGE_START) {
      value = this.uint32()
    }
    return value < limit
      ? integerAt(min, max, Math.floor(value / bucket))
      : integerEdge(min, max, value - EDGE_START)
  }

  float = (min: number, max: number, options?: RandomNumberOptions): number => {
    const uniform = isUniform(options, 'float')
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
      throw new RangeError(
        `random.float() expects finite numbers with min <= max, received ${min} and ${max}.`,
      )
    }
    const range = max - min
    if (!Number.isFinite(range)) {
      throw new RangeError(
        `random.float() supports a range of at most Number.MAX_VALUE, received ${min} and ${max}.`,
      )
    }
    if (range === 0) {
      return min
    }
    let value = this.floatIn(min, max, range, uniform)
    // rounding can give `max` if the range is small compared to `min`
    while (value >= max) {
      value = this.floatIn(min, max, range, uniform)
    }
    return value
  }

  bool = (probability = 0.5): boolean => {
    if (!(probability >= 0 && probability <= 1)) {
      throw new RangeError(
        `random.bool() expects a probability between 0 and 1, received ${probability}.`,
      )
    }
    // `true` for the top part of the raw values, so that a raw 0 gives `false`
    return this.uint32() >= (1 - probability) * UINT32_RANGE
  }

  pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) {
      throw new RangeError('random.pick() cannot pick from an empty array.')
    }
    return items[this.itemIndex(items.length)]
  }

  weighted = <T>(entries: readonly (readonly [value: T, weight: number])[]): T => {
    let total = 0
    for (const [, weight] of entries) {
      if (!Number.isFinite(weight) || weight < 0) {
        throw new RangeError(
          `random.weighted() expects finite weights that are 0 or more, received ${weight}.`,
        )
      }
      total += weight
    }
    if (!Number.isFinite(total)) {
      throw new RangeError(
        'random.weighted() supports a sum of weights of at most Number.MAX_VALUE.',
      )
    }
    if (total === 0) {
      throw new RangeError('random.weighted() needs at least one weight above 0.')
    }
    let target = this.next() * total
    let lastIndex = 0
    for (let i = 0; i < entries.length; i++) {
      const [value, weight] = entries[i]
      if (weight === 0) {
        continue
      }
      if (target < weight) {
        return value
      }
      target -= weight
      lastIndex = i
    }
    // rounding errors can leave a small rest after the last weight
    return entries[lastIndex][0]
  }

  shuffle = <T>(items: readonly T[]): T[] => {
    const result = [...items]
    for (let i = result.length - 1; i > 0; i--) {
      // a raw 0 gives `j = i`, so the item stays in place
      const j = i - this.itemIndex(i + 1)
      const item = result[i]
      result[i] = result[j]
      result[j] = item
    }
    return result
  }

  sample = <T>(items: readonly T[], count: number): T[] => {
    if (!Number.isSafeInteger(count) || count < 0 || count > items.length) {
      throw new RangeError(
        `random.sample() expects a count between 0 and ${items.length}, received ${count}.`,
      )
    }
    const result = [...items]
    for (let i = 0; i < count; i++) {
      const j = i + this.itemIndex(result.length - i)
      const item = result[i]
      result[i] = result[j]
      result[j] = item
    }
    result.length = count
    return result
  }

  bytes = (length: number): Uint8Array => {
    if (!Number.isSafeInteger(length) || length < 0) {
      throw new RangeError(`random.bytes() expects a length of 0 or more, received ${length}.`)
    }
    const bytes = new Uint8Array(length)
    for (let i = 0; i < length; i += 4) {
      const value = this.uint32()
      for (let byte = 0; byte < 4 && i + byte < length; byte++) {
        bytes[i + byte] = value >>> (byte * 8)
      }
    }
    return bytes
  }

  uuid = (): string => {
    const bytes = this.bytes(16)
    // the version (4) and the variant (binary 10) of RFC 9562
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = getHexBytes()
    let uuid = ''
    for (let i = 0; i < 16; i++) {
      uuid += hex[bytes[i]]
      // groups of 8-4-4-4-12 hexadecimal digits
      if (i === 3 || i === 5 || i === 7 || i === 9) {
        uuid += '-'
      }
    }
    return uuid
  }

  fork = (label: string): RandomSource => {
    this.forks ??= new Set()
    if (this.forks.has(label)) {
      throw new Error(
        `random.fork("${label}") was already called on the random source with the seed ${this.seed}. Use a different label for each fork.`,
      )
    }
    this.forks.add(label)
    return new SeededRandom(deriveSeed(['fork', this.seed, label]))
  }

  clone = (): RandomSource => {
    const copy = new SeededRandom(this.seed)
    copy.s0 = this.s0
    copy.s1 = this.s1
    copy.s2 = this.s2
    copy.s3 = this.s3
    copy.forks = this.forks && new Set(this.forks)
    return copy
  }

  // an integer in `[0, count)` without edge cases
  private itemIndex(count: number): number {
    const bucket = Math.floor(UINT32_RANGE / count)
    const limit = bucket * count
    let value = this.uint32()
    while (value >= limit) {
      value = this.uint32()
    }
    return Math.floor(value / bucket)
  }

  private floatIn(min: number, max: number, range: number, uniform: boolean): number {
    const first = this.uint32()
    const second = this.uint32()
    if (!uniform && first >= EDGE_START) {
      return floatEdge(min, max, first - EDGE_START)
    }
    const indexes = uniform ? UINT53_RANGE : FLOAT_INDEXES
    if (min >= 0 || max <= 0) {
      return min + (((first >>> 5) * UINT26_RANGE + (second >>> 6)) / indexes) * range
    }
    // The range contains 0. The lowest bit selects the sign, and the other bits the distance
    // from 0, so that a smaller index gives a float nearer to 0. Both sides have the same
    // distances up to `paired`, and only the larger side has the distances above it.
    const offset = (((first >>> 5) * UINT25_RANGE + (second >>> 7)) / (indexes / 2)) * range
    const paired = Math.min(max, -min)
    if (offset >= 2 * paired) {
      return max > -min ? offset - paired : paired - offset
    }
    const distance = offset / 2
    return (second & 0x40) !== 0 && distance > 0 ? -distance : distance
  }
}

// The index 0 gives the integer nearest to 0. If the range contains 0, the order is
// 0, 1, -1, 2, -2 and so on, until one side ends.
function integerAt(min: number, max: number, index: number): number {
  if (min >= 0) {
    return min + index
  }
  if (max <= 0) {
    return max - index
  }
  if (index === 0) {
    return 0
  }
  const paired = Math.min(max, -min)
  if (index > 2 * paired) {
    return max > -min ? index - paired : paired - index
  }
  const distance = Math.ceil(index / 2)
  return (index & 1) === 1 ? distance : -distance
}

// The edges are ordered by their distance from 0, so that a smaller offset gives a simpler
// edge: 0, 1 and -1 if the range contains them, then `min` and `max`.
function integerEdge(min: number, max: number, offset: number): number {
  let count = 0
  if (min <= 0 && max >= 0) {
    edges[count++] = 0
  }
  if (min <= 1 && max >= 1) {
    edges[count++] = 1
  }
  if (min <= -1 && max >= -1) {
    edges[count++] = -1
  }
  const near = max <= -min ? max : min
  const far = near === max ? min : max
  if (near > 1 || near < -1) {
    edges[count++] = near
  }
  if (far !== near && (far > 1 || far < -1)) {
    edges[count++] = far
  }
  return edges[Math.floor((offset * count) / EDGE_RANGE)]
}

// 0 if the range contains it, then `min` and the largest float below `max`, ordered by their
// distance from 0
function floatEdge(min: number, max: number, offset: number): number {
  let count = 0
  if (min <= 0 && max > 0) {
    edges[count++] = 0
  }
  const below = nextDown(max)
  const belowFirst =
    Math.abs(below) < Math.abs(min) || (Math.abs(below) === Math.abs(min) && below > min)
  const near = belowFirst ? below : min
  const far = belowFirst ? min : below
  if (near !== 0) {
    edges[count++] = near
  }
  if (far !== near && far !== 0) {
    edges[count++] = far
  }
  return edges[Math.floor((offset * count) / EDGE_RANGE)]
}

// the largest float below `value`
function nextDown(value: number): number {
  if (value === 0) {
    return -Number.MIN_VALUE
  }
  const view = (floatView ??= new DataView(new ArrayBuffer(8)))
  view.setFloat64(0, value)
  // the bits of a positive float grow with its value, the bits of a negative float shrink
  const bits = view.getBigUint64(0)
  view.setBigUint64(0, value > 0 ? bits - 1n : bits + 1n)
  return view.getFloat64(0)
}

function rotateLeft(value: number, bits: number): number {
  return (value << bits) | (value >>> (32 - bits))
}

// The output function of splitmix64:
//   value ^= value >> 30; value *= 0xbf58476d1ce4e5b9
//   value ^= value >> 27; value *= 0x94d049bb133111eb
//   value ^= value >> 31
// On halves, the lower half of `value >> n` is `(low >>> n) | (high << (32 - n))`.
function mix64(high: number, low: number): void {
  low = (low ^ ((low >>> 30) | (high << 2))) >>> 0
  high = (high ^ (high >>> 30)) >>> 0
  multiply64(high, low, 0xbf58_476d, 0x1ce4_e5b9)
  high = mixHigh
  low = mixLow
  low = (low ^ ((low >>> 27) | (high << 5))) >>> 0
  high = (high ^ (high >>> 27)) >>> 0
  multiply64(high, low, 0x94d0_49bb, 0x1331_11eb)
  high = mixHigh
  low = mixLow
  mixLow = (low ^ ((low >>> 31) | (high << 1))) >>> 0
  mixHigh = (high ^ (high >>> 31)) >>> 0
}

// Multiplies two 64-bit values modulo 2^64:
//   (high * 2^32 + low) * (factorHigh * 2^32 + factorLow)
//     = low * factorLow + (high * factorLow + low * factorHigh) * 2^32 (modulo 2^64)
// The second term needs only its lower 32 bits (`Math.imul`). The first one also needs its
// upper 32 bits, which carry into `high`.
function multiply64(high: number, low: number, factorHigh: number, factorLow: number): void {
  // the upper 32 bits of `low * factorLow`, from 16-bit parts, so that no value exceeds 2^53
  const low0 = low & 0xffff
  const low1 = low >>> 16
  const factor0 = factorLow & 0xffff
  const factor1 = factorLow >>> 16
  const middle = low1 * factor0 + ((low0 * factor0) >>> 16)
  const middle2 = low0 * factor1 + (middle & 0xffff)
  const carry = low1 * factor1 + (middle >>> 16) + (middle2 >>> 16)
  mixLow = Math.imul(low, factorLow) >>> 0
  mixHigh = (carry + Math.imul(high, factorLow) + Math.imul(low, factorHigh)) >>> 0
}

function toHex(value: number): string {
  const hex = getHexBytes()
  return (
    hex[value >>> 24] + hex[(value >>> 16) & 0xff] + hex[(value >>> 8) & 0xff] + hex[value & 0xff]
  )
}

function getHexBytes(): string[] {
  return (hexBytes ??= Array.from({ length: 256 }, (_, byte) => byte.toString(16).padStart(2, '0')))
}
