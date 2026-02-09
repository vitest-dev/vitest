import { expect, test, vi } from 'vitest'
// @ts-ignore
import * as dep from '@vitest/test-dep-invalid'

vi.mock('@vitest/test-dep-invalid', () => ({ hi: 'yo' }))

test('repro', () => {
  expect(dep.hi).toBe('yo')
})
