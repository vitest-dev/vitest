/**
 * Test case for https://github.com/vitest-dev/vitest/issues/XXXX
 *
 * Verifies that vitest types work correctly with:
 * - `skipLibCheck: false`
 * - `exactOptionalPropertyTypes: true`
 * - `lib: ["ES2021"]` (without esnext.disposable)
 */

import type { TestAttachment } from '@vitest/runner'
import type { MockInstance } from '@vitest/spy'
import { vi } from 'vitest'

// 1. Verify MockInstance (which extends Disposable) is usable
//    without lib: "esnext" — requires `/// <reference lib="esnext.disposable" />`
//    in the generated .d.ts
function _useMockInstance(mock: MockInstance): void {
  mock.mockClear()
}

// 2. Verify vi.doMock() return type (Disposable) works without esnext lib
function _useDoMock(): void {
  const disposable = vi.doMock('./some-module')
  if (Symbol.dispose) {
    disposable[Symbol.dispose]()
  }
}

// 3. Verify that TestAttachment subtypes with required `path` are assignable
//    to TestAttachment with `exactOptionalPropertyTypes: true`
//    (the FailureScreenshotArtifactAttachment fix)
interface PathBasedAttachment extends TestAttachment {
  path: string
  originalPath: string
}

function _acceptTestAttachment(_: TestAttachment): void {}

const pathAttachment: PathBasedAttachment = {
  path: '/tmp/screenshot.png',
  originalPath: '/original/screenshot.png',
}

// This should compile without error — PathBasedAttachment must be assignable to TestAttachment
_acceptTestAttachment(pathAttachment)
