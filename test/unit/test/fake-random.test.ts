import nodeCrypto, {
  randomBytes,
  randomFill,
  randomFillSync,
  randomInt,
  randomUUID,
} from 'node:crypto'
import { createRequire } from 'node:module'
import { createRandomSource } from '@vitest/utils/random-source'
import { afterEach, expect, test, vi } from 'vitest'

const require = createRequire(import.meta.url)
const requiredCrypto: typeof nodeCrypto = require('node:crypto')

afterEach(() => {
  vi.useRealRandom()
})

test('returns the values of random.fork("vitest:globals")', ({ random }) => {
  vi.useFakeRandom()
  const expected = createRandomSource(random.seed).fork('vitest:globals')

  expect(Math.random()).toBe(expected.next())
  expect(crypto.randomUUID()).toBe(expected.uuid())
  expect(crypto.getRandomValues(new Uint8Array(5))).toEqual(expected.bytes(5))
  expect(new Uint8Array(crypto.getRandomValues(new Uint32Array(2)).buffer)).toEqual(
    expected.bytes(8),
  )
})

test('restores the real functions', () => {
  const realRandom = Math.random
  const realGetRandomValues = crypto.getRandomValues
  const realRandomUUID = crypto.randomUUID

  vi.useFakeRandom()
  expect(vi.isFakeRandom()).toBe(true)
  expect(Math.random).not.toBe(realRandom)
  expect(crypto.getRandomValues).not.toBe(realGetRandomValues)
  expect(crypto.randomUUID).not.toBe(realRandomUUID)

  vi.useRealRandom()
  expect(vi.isFakeRandom()).toBe(false)
  expect(Math.random).toBe(realRandom)
  expect(crypto.getRandomValues).toBe(realGetRandomValues)
  expect(crypto.randomUUID).toBe(realRandomUUID)
  expect(Object.hasOwn(crypto, 'randomUUID')).toBe(false)
})

test('a second call keeps the values of the test', ({ random }) => {
  const expected = createRandomSource(random.seed).fork('vitest:globals')
  vi.useFakeRandom()
  expect(Math.random()).toBe(expected.next())
  vi.useFakeRandom()
  expect(Math.random()).toBe(expected.next())
})

const tenantTest = test.extend({
  tenant: [
    async ({}, use) => {
      vi.useFakeRandom()
      await use(crypto.randomUUID())
    },
    { scope: 'file' },
  ],
})

tenantTest('a file fixture does not take the values of the test', ({ tenant, random }) => {
  const expected = createRandomSource(random.seed).fork('vitest:globals')
  expect(Math.random()).toBe(expected.next())
  expect(tenant).toMatch(/^[\da-f]{8}-[\da-f]{4}-4/)
})

test('crypto throws the errors of the real functions', () => {
  vi.useFakeRandom()
  expect(errorOf(() => crypto.getRandomValues(new Float64Array(1)))).toMatchInlineSnapshot(
    `"TypeMismatchError: The data argument must be an integer-type TypedArray"`,
  )
  expect(errorOf(() => crypto.getRandomValues(new Uint8Array(65_537)))).toMatchInlineSnapshot(
    `"QuotaExceededError: The requested length exceeds 65,536 bytes"`,
  )
  const { randomUUID } = crypto
  expect(errorOf(() => randomUUID())).toMatchInlineSnapshot(
    `"TypeError: Value of "this" must be of type Crypto"`,
  )
})

test('replaces node:crypto imports', ({ random }) => {
  vi.useFakeRandom()
  const expected = createRandomSource(random.seed).fork('vitest:globals')

  expect(randomUUID()).toBe(expected.uuid())
  expect(nodeCrypto.randomUUID()).toBe(expected.uuid())
  expect(requiredCrypto.randomUUID()).toBe(expected.uuid())
  expect(new Uint8Array(randomBytes(6))).toEqual(expected.bytes(6))

  const buffer = new Uint16Array(4)
  randomFillSync(buffer, 1, 2)
  expect(new Uint8Array(buffer.buffer, 2, 4)).toEqual(expected.bytes(4))
})

test('replaces the callback versions of node:crypto', async ({ random }) => {
  vi.useFakeRandom()
  const expected = createRandomSource(random.seed).fork('vitest:globals')

  const [bytes, filled] = await Promise.all([
    new Promise<Buffer>((resolve, reject) => {
      randomBytes(3, (error, buffer) => (error ? reject(error) : resolve(buffer)))
    }),
    new Promise<Uint8Array>((resolve, reject) => {
      randomFill(new Uint8Array(4), (error, buffer) => (error ? reject(error) : resolve(buffer)))
    }),
  ])
  // the values are taken in the order of the calls, not of the callbacks
  expect(new Uint8Array(bytes)).toEqual(expected.bytes(3))
  expect(filled).toEqual(expected.bytes(4))
})

test('randomInt returns integers in the range', () => {
  vi.useFakeRandom()
  const values = Array.from({ length: 100 }, () => randomInt(-3, 3))
  expect(values.every((value) => Number.isInteger(value) && value >= -3 && value < 3)).toBe(true)
  expect(new Set(values).size).toBe(6)
  expect(randomInt(2 ** 48 - 1)).toBeLessThan(2 ** 48 - 1)
})

test('node:crypto throws the errors of Node.js', () => {
  vi.useFakeRandom()
  expect(() => randomInt(5, 1)).toThrowErrorMatchingInlineSnapshot(
    `[RangeError: The value of "max" is out of range. It must be greater than the value of "min" (5). Received 1]`,
  )
  expect(() => randomInt(2 ** 49)).toThrowErrorMatchingInlineSnapshot(
    `[RangeError: The value of "max" is out of range. It must be <= 281474976710655. Received 562_949_953_421_312]`,
  )
  expect(() => randomInt(2 ** 49, () => {})).toThrowErrorMatchingInlineSnapshot(
    `[RangeError: The value of "max" is out of range. It must be <= 281474976710655. Received 562_949_953_421_312]`,
  )
  expect(() => randomBytes(-1)).toThrowErrorMatchingInlineSnapshot(
    `[RangeError: The value of "size" is out of range. It must be >= 0 && <= 2147483647. Received -1]`,
  )
  expect(() => randomFillSync(new Uint8Array(2), 3)).toThrowErrorMatchingInlineSnapshot(
    `[RangeError: The value of "offset" is out of range. It must be >= 0 && <= 2. Received 3]`,
  )
  // @ts-expect-error the callback is missing
  expect(() => randomFill(new Uint8Array(2), 0)).toThrowErrorMatchingInlineSnapshot(
    `[TypeError: The "callback" argument must be of type function. Received undefined]`,
  )
})

test.concurrent('throws in a concurrent test', ({ expect }) => {
  vi.useFakeRandom()
  expect(() => Math.random()).toThrowErrorMatchingInlineSnapshot(
    `[Error: The fake random functions cannot be used in concurrent tests and suites, because their values would depend on the order of the calls. Use \`context.random\` or \`vi.createRandom()\` instead.]`,
  )
  expect(() => randomBytes(4, () => {})).toThrowErrorMatchingInlineSnapshot(
    `[Error: The fake random functions cannot be used in concurrent tests and suites, because their values would depend on the order of the calls. Use \`context.random\` or \`vi.createRandom()\` instead.]`,
  )
})

test('restores node:crypto imports', () => {
  const realRandomUUID = randomUUID
  const realRandomBytes = randomBytes
  vi.useFakeRandom()
  expect(randomUUID).not.toBe(realRandomUUID)
  expect(nodeCrypto.randomBytes).not.toBe(realRandomBytes)

  vi.useRealRandom()
  expect(randomUUID).toBe(realRandomUUID)
  expect(randomBytes).toBe(realRandomBytes)
  expect(nodeCrypto.randomBytes).toBe(realRandomBytes)
  expect(requiredCrypto.randomBytes).toBe(realRandomBytes)
})

// a DOMException of the host has no snapshot format in the vm pools
function errorOf(fn: () => unknown): string | undefined {
  try {
    fn()
  } catch (error: any) {
    return `${error.name}: ${error.message}`
  }
}
