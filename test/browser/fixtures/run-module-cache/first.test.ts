import { expect, test } from 'vitest'
import { value } from './shared'

test('imports the shared module', () => {
  expect(value).toBe('shared')
})
