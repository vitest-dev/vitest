// @ts-expect-error no type
import * as dep from '@vitest/test-dep-invalid'

import { expect, test, vi } from 'vitest'

vi.mock('@vitest/test-dep-invalid', () => ({ hi: 'yo' }))

test('repro', () => {
  expect(dep.hi).toBe('yo')
})
