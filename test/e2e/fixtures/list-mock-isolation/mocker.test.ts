import { expect, test, vi } from 'vitest'

vi.mock('./m', () => ({ a: 'mocked-a' }))

import { a } from './m'

test('sees the mock', () => {
  expect(a).toBe('mocked-a')
})
