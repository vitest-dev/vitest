// @vitest-environment node

import { expect, test } from 'vitest'

// @ts-expect-error untyped
import { importMetaUrl } from '@vitest/test-dep-url'

// TODO: flaky on Windows
// https://github.com/vitest-dev/vitest/pull/5215#discussion_r1492066033
test.skipIf(process.platform === 'win32')('import.meta.url', () => {
  expect(importMetaUrl).toContain('/node_modules/.vitest/deps_ssr/')
})
