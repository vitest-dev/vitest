// @vitest-environment happy-dom

// @ts-expect-error untyped
import { importMetaUrl } from '@vitest/test-dep-url'

import { expect, test } from 'vitest'

test('import.meta.url', () => {
  expect(importMetaUrl).toContain('/node_modules/.vite/vitest/da39a3ee5e6b4b0d3255bfef95601890afd80709/deps/')
})
