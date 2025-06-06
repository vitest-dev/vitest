// @vitest-environment node

// @ts-expect-error untyped
import { importMetaUrl } from '@vitest/test-dep-url'

import { expect, test } from 'vitest'

// TODO: flaky on Windows
// https://github.com/vitest-dev/vitest/pull/5215#discussion_r1492066033
test.skipIf(process.platform === 'win32')('import.meta.url', () => {
  expect(importMetaUrl).toContain('/node_modules/.vite/vitest/da39a3ee5e6b4b0d3255bfef95601890afd80709/deps_ssr/')
})
