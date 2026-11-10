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
   * Returns an integer in `[min, max]`. Each integer has the same chance.
   */
  int: (min: number, max: number) => number
  /**
   * Returns a float in `[min, max)`, or `min` if `min` equals `max`.
   */
  float: (min?: number, max?: number) => number
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
   * not on the values that this random source returned before.
   */
  fork: (label: string) => RandomSource
}

const MASK_64 = 0xffff_ffff_ffff_ffffn
const GOLDEN_GAMMA = 0x9e37_79b9_7f4a_7c15n
const UINT32_RANGE = 2 ** 32
const UINT26_RANGE = 2 ** 26
const UINT53_RANGE = 2 ** 53
const SEED_PATTERN = /^[\da-f]{16}$/i

let encoder: TextEncoder | undefined

export function deriveSeed(parts: readonly string[]): string {
  return formatSeed(mix64(fnv1a64(JSON.stringify(parts))))
}

export function createRandomSource(seed: string): RandomSource {
  return new SeededRandom(seed)
}

// Each method maps raw values of 0 to its simplest result
// (`min`, `false`, the first item, the same order). Shrinking depends on it.
class SeededRandom implements RandomSource {
  readonly seed: string
  private s0: number
  private s1: number
  private s2: number
  private s3: number
  private forks = new Set<string>()

  constructor(seed: string) {
    if (!SEED_PATTERN.test(seed)) {
      throw new TypeError(`The seed must be 16 hexadecimal digits, received "${seed}".`)
    }
    this.seed = seed.toLowerCase()

    // splitmix64 makes the xoshiro128** state from the seed, as the authors of xoshiro recommend
    let state = BigInt(`0x${seed}`)
    state = (state + GOLDEN_GAMMA) & MASK_64
    const first = mix64(state)
    state = (state + GOLDEN_GAMMA) & MASK_64
    const second = mix64(state)
    this.s0 = Number(first & 0xffff_ffffn) | 0
    this.s1 = Number(first >> 32n) | 0
    this.s2 = Number(second & 0xffff_ffffn) | 0
    this.s3 = Number(second >> 32n) | 0
  }

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

  next = (): number => {
    const high = this.uint32() >>> 5
    const low = this.uint32() >>> 6
    return (high * UINT26_RANGE + low) / UINT53_RANGE
  }

  int = (min: number, max: number): number => {
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
    // values above the last full bucket are drawn again, so each result has the same chance
    const bucket = Math.floor(UINT32_RANGE / range)
    const limit = bucket * range
    let value = this.uint32()
    while (value >= limit) {
      value = this.uint32()
    }
    return min + Math.floor(value / bucket)
  }

  float = (min = 0, max = 1): number => {
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
    let value = min + this.next() * range
    // rounding can give `max` if the range is small compared to `min`
    while (value >= max) {
      value = min + this.next() * range
    }
    return value
  }

  bool = (probability = 0.5): boolean => {
    if (!(probability >= 0 && probability <= 1)) {
      throw new RangeError(
        `random.bool() expects a probability between 0 and 1, received ${probability}.`,
      )
    }
    return this.uint32() >= (1 - probability) * UINT32_RANGE
  }

  pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) {
      throw new RangeError('random.pick() cannot pick from an empty array.')
    }
    return items[this.int(0, items.length - 1)]
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
      const j = i - this.int(0, i)
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
      const j = i + this.int(0, result.length - 1 - i)
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
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  fork = (label: string): RandomSource => {
    if (this.forks.has(label)) {
      throw new Error(
        `random.fork("${label}") was already called on the random source with the seed ${this.seed}. Use a different label for each fork.`,
      )
    }
    this.forks.add(label)
    return new SeededRandom(deriveSeed(['fork', this.seed, label]))
  }
}

function rotateLeft(value: number, bits: number): number {
  return (value << bits) | (value >>> (32 - bits))
}

function fnv1a64(text: string): bigint {
  let hash = 0xcbf2_9ce4_8422_2325n
  for (const byte of (encoder ??= new TextEncoder()).encode(text)) {
    hash = ((hash ^ BigInt(byte)) * 0x100_0000_01b3n) & MASK_64
  }
  return hash
}

// the output function of splitmix64
function mix64(value: bigint): bigint {
  value = ((value ^ (value >> 30n)) * 0xbf58_476d_1ce4_e5b9n) & MASK_64
  value = ((value ^ (value >> 27n)) * 0x94d0_49bb_1331_11ebn) & MASK_64
  return value ^ (value >> 31n)
}

function formatSeed(value: bigint): string {
  return value.toString(16).padStart(16, '0')
}
