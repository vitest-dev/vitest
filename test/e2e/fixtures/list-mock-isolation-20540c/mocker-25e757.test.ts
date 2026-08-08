import { expect, test, vi } from 'vitest'

vi.mock('./m-module-25e757', () => ({ a: 'mocked-a' }))

import { a } from './m-module-25e757'

test('sees the mock', () => {
  expect(a).toBe('mocked-a')
})
