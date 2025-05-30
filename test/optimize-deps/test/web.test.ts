// @vitest-environment happy-dom

// @ts-expect-error untyped
import { importMetaUrl } from '@vitest/test-dep-url'

import { expect, test } from 'vitest'

test('import.meta.url', () => {
  expect(importMetaUrl).toContain('/node_modules/.vite/vitest/d41d8cd98f00b204e9800998ecf8427e/deps/')
})
