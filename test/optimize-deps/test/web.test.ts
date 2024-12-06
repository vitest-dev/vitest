// @vitest-environment happy-dom

// @ts-expect-error untyped
import { importMetaUrl } from '@vitest/test-dep-url'

import { expect, test } from 'vitest'

test('import.meta.url', () => {
  expect(importMetaUrl).toContain('/node_modules/.vite/vitest/deps/')
})
