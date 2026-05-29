import { test, expect } from 'vitest'

test('importOriginal strips _vitest_original correctly with subsequent queries', async () => {
  /* This explicitly forces the string: ...target.ts?_vitest_original&v=123
    Old code transforms this to: ...target.ts&v=123 (CRASHES: ERR_MODULE_NOT_FOUND)
    New code transforms this to: ...target.ts?v=123 (PASSES)
    See: https://github.com/vitest-dev/vitest/issues/9887
  */
  // @ts-expect-error
  const mod = await import('./target.ts?_vitest_original&v=123') as typeof import('./target.ts')
  expect(mod.value).toBe('target')
})
