// @vitest-environment node

// @ts-expect-error untyped
import { importMetaUrl } from '@vitest/test-dep-url'

import { expect, test } from 'vitest'

// TODO: flaky on Windows
// https://github.com/vitest-dev/vitest/pull/5215#discussion_r1492066033
test.skipIf(process.platform === 'win32')('import.meta.url', () => {
  expect(importMetaUrl).toContain('/node_modules/.vite/vitest/d41d8cd98f00b204e9800998ecf8427e/deps_ssr/')
})
