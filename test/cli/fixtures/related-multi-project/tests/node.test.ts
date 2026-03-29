import { expect, test } from 'vitest'
import { value } from '../src/shared'

test('node project uses shared module', () => {
  expect(value).toBe('shared')
})
