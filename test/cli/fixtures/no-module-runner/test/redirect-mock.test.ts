import { expect, test, vi } from 'vitest'
import redirect from '../src/redirect.ts'

vi.mock(import('../src/redirect.ts'))

test('squared is mocked', () => {
  expect(redirect).toBe(true)
})
