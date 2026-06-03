import { expect, test, vi } from 'vitest'
// @ts-expect-error
import { importMetaUrl } from '@test/test-dep-url'

vi.mock('@test/test-dep-url', async (importOriginal) => ({
  ...(await importOriginal()),
  testFn: vi.fn(),
}))

/* This reproduces the bug from https://github.com/vitest-dev/vitest/issues/9887
    Using the `test.deps.optimizer.client` and `importOriginal` mock
    Old code transforms this to: ...target.ts&v=123 (CRASHES: ERR_MODULE_NOT_FOUND)
    New code transforms this to: ...target.ts?v=123 (PASSES)
  */
test('importOriginal', () => {
  expect(importMetaUrl).toContain('/node_modules/.vite/vitest/da39a3ee5e6b4b0d3255bfef95601890afd80709')
})
