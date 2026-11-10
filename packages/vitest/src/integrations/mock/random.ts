import type { RandomSource } from '@vitest/utils/random-source'

type Callback<T> = (error: Error | null, value: T) => void
type FillTarget =
  | ArrayBuffer
  | SharedArrayBuffer
  | (ArrayBufferView & { BYTES_PER_ELEMENT?: number })

// the parts of `node:crypto` that the fake replaces
interface NodeCryptoRandom {
  randomBytes: (size: number, callback?: Callback<Uint8Array>) => Uint8Array | undefined
  randomFill: (
    buffer: FillTarget,
    offset?: number | Callback<FillTarget>,
    size?: number | Callback<FillTarget>,
    callback?: Callback<FillTarget>,
  ) => void
  randomFillSync: (buffer: FillTarget, offset?: number, size?: number) => FillTarget
  randomInt: (
    min: number,
    max?: number | Callback<number>,
    callback?: Callback<number>,
  ) => number | undefined
  randomUUID: (options?: unknown) => string
}

interface VitestRequired {
  crypto: NodeCryptoRandom
  syncBuiltinESMExports: () => void
}

const UINT32_RANGE = 2 ** 32
// the limit of `randomInt` in Node.js
const RAND_MAX = 0xffff_ffff_ffff

export class FakeRandom {
  private restores: (() => void)[] | undefined

  constructor(
    private global: typeof globalThis,
    private getSource: () => RandomSource,
  ) {}

  useFakeRandom(): void {
    this.useRealRandom()
    const restores: (() => void)[] = []
    const getSource = this.getSource

    replaceProperty(this.global.Math, 'random', () => getSource().next(), restores)

    const crypto = this.global.crypto
    if (crypto) {
      const getRandomValues = crypto.getRandomValues
      replaceProperty(
        crypto,
        'getRandomValues',
        function (this: Crypto, array: ArrayBufferView) {
          // the real function throws the errors for invalid arguments
          getRandomValues.call(this, array)
          return fillBytes(array, getSource())
        },
        restores,
      )
      replaceProperty(crypto, 'randomUUID', () => getSource().uuid(), restores)
    }

    // @ts-expect-error not typed global
    const required: VitestRequired | undefined = this.global.__vitest_required__
    // only in Node.js
    if (required) {
      // runs after the other restores
      restores.push(() => required.syncBuiltinESMExports())
      const fakes = createNodeCryptoFakes(required.crypto, getSource)
      for (const [name, fake] of Object.entries(fakes)) {
        replaceProperty(required.crypto, name, fake, restores)
      }
      required.syncBuiltinESMExports()
    }

    this.restores = restores
  }

  useRealRandom(): void {
    for (const restore of this.restores?.reverse() ?? []) {
      restore()
    }
    this.restores = undefined
  }

  isFakeRandom(): boolean {
    return this.restores !== undefined
  }
}

// The fakes call the real functions first, so that invalid arguments throw the errors of Node.js
// and callbacks run at the same time. Then they replace the values. They take the values when
// they are called, not in the callback, so that the order of callbacks does not change them.
function createNodeCryptoFakes(
  real: NodeCryptoRandom,
  getSource: () => RandomSource,
): NodeCryptoRandom {
  const { randomBytes, randomFill, randomFillSync, randomInt, randomUUID } = real
  return {
    randomBytes(size, callback) {
      if (typeof callback !== 'function') {
        const buffer = randomBytes(size, callback)
        return buffer && fillBytes(buffer, getSource())
      }
      let bytes: Uint8Array | undefined
      randomBytes(size, (error, buffer) => {
        if (!error && bytes) {
          buffer.set(bytes)
        }
        callback(error, buffer)
      })
      // with a size of 0, the callback ran before this line
      bytes = getSource().bytes(size >>> 0)
    },

    randomFillSync(buffer, offset, size) {
      randomFillSync(buffer, offset, size)
      const range = getByteRange(buffer, offset, size)
      range.set(getSource().bytes(range.length))
      return buffer
    },

    randomFill(buffer, offset, size, callback) {
      if (typeof offset === 'function') {
        callback = offset
        offset = 0
        size = undefined
      } else if (typeof size === 'function') {
        callback = size
        size = undefined
      }
      if (typeof callback !== 'function') {
        return randomFill(buffer, offset, size, callback)
      }
      const done = callback
      let fill: (() => void) | undefined
      randomFill(buffer, offset, size, (error, result) => {
        if (!error) {
          fill?.()
        }
        done(error, result)
      })
      // with a size of 0, the callback ran before this line
      const range = getByteRange(buffer, offset, size)
      const bytes = getSource().bytes(range.length)
      fill = () => range.set(bytes)
    },

    randomInt(min, max, callback) {
      if (max === undefined || typeof max === 'function') {
        callback = max
        max = min
        min = 0
      }
      if (typeof callback !== 'function') {
        randomInt(min, max, callback)
        return getInt(getSource(), min, max)
      }
      const done = callback
      let value: number
      randomInt(min, max, (error) => done(error, value))
      value = getInt(getSource(), min, max)
    },

    randomUUID(options) {
      if (options !== undefined) {
        randomUUID(options)
      }
      return getSource().uuid()
    },
  }
}

function replaceProperty(
  target: object,
  key: string,
  value: unknown,
  restores: (() => void)[],
): void {
  const descriptor = Object.getOwnPropertyDescriptor(target, key)
  Object.defineProperty(target, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: descriptor?.enumerable ?? false,
  })
  restores.push(() => {
    if (descriptor) {
      Object.defineProperty(target, key, descriptor)
    } else {
      Reflect.deleteProperty(target, key)
    }
  })
}

function fillBytes<T extends ArrayBufferView>(view: T, source: RandomSource): T {
  new Uint8Array(view.buffer, view.byteOffset, view.byteLength).set(source.bytes(view.byteLength))
  return view
}

// the bytes that `randomFill` and `randomFillSync` fill: `offset` and `size` count items, not bytes
function getByteRange(buffer: FillTarget, offset = 0, size?: number): Uint8Array {
  const view = ArrayBuffer.isView(buffer) ? buffer : new Uint8Array(buffer)
  const itemSize = view.BYTES_PER_ELEMENT || 1
  const start = (offset * itemSize) >>> 0
  const length = size === undefined ? view.byteLength - start : (size * itemSize) >>> 0
  return new Uint8Array(view.buffer, view.byteOffset + start, length)
}

// as `randomInt` of Node.js: 48 random bits, without the values above the last full range
function getInt(source: RandomSource, min: number, max: number): number {
  const range = max - min
  const limit = RAND_MAX - (RAND_MAX % range)
  let value: number
  do {
    value = (source.uint32() >>> 16) * UINT32_RANGE + source.uint32()
  } while (value >= limit)
  return min + (value % range)
}
