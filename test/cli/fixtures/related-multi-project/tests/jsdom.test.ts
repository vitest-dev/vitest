import { expect, test } from 'vitest'
import { value } from '../src/shared'

test('jsdom project uses shared module', () => {
  expect(value).toBe('shared')
})
