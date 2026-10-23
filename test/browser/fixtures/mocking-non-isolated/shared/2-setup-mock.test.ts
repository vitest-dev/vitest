import { expect, test } from 'vitest'
import { shared } from '../src/shared'

test('the mock from the setup file', () => {
  expect(shared()).toBe('setup mock')
})
