import { expect, test } from 'vitest'

import { capitalize } from './string'

test('should capitalize strings correctly', () => {
  expect(capitalize('i Love Vitest')).toBe('I love vitest')
})
