import { expect, test } from 'vitest'

test('worker inherits the compile cache dir from NODE_COMPILE_CACHE', () => {
  // gate on the discriminator between the two compile-cache.test.ts runs, not
  // on EXPECTED_COMPILE_CACHE_DIR itself — if the spec's env stops
  // propagating, this fails loudly (toBe(undefined)) instead of passing
  // vacuously
  if (!process.env.NODE_DISABLE_COMPILE_CACHE) {
    expect(process.env.NODE_COMPILE_CACHE).toBe(process.env.EXPECTED_COMPILE_CACHE_DIR)
  }
  expect(document).toBeDefined()
})
