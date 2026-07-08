import { expect, test } from 'vitest'

test('worker sees the expected compile cache environment', () => {
  // set when the spec expects the v8 coverage provider to strip the cache
  if (process.env.EXPECT_COVERAGE_STRIPPED) {
    expect(process.env.NODE_COMPILE_CACHE).toBeUndefined()
    expect(process.env.NODE_DISABLE_COMPILE_CACHE).toBe('1')
  }
  // gate on the discriminator between the spec's runs, not on
  // EXPECTED_COMPILE_CACHE_DIR itself — if the spec's env stops propagating,
  // this fails loudly (toBe(undefined)) instead of passing vacuously
  else if (!process.env.NODE_DISABLE_COMPILE_CACHE) {
    expect(process.env.NODE_COMPILE_CACHE).toBe(process.env.EXPECTED_COMPILE_CACHE_DIR)
  }
  expect(document).toBeDefined()
})
