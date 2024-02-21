// @vitest-environment happy-dom

import { expect, test } from 'vitest'

// @ts-expect-error untyped
import { importMetaUrl } from '@vitest/test-dep-url'

test('import.meta.url', () => {
  expect(importMetaUrl).toContain('/node_modules/.vite/deps/')
})
