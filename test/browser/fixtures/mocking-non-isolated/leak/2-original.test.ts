import { expect, test } from 'vitest'
import { leak } from '../src/leak'

test('the original is imported after the mock', () => {
  expect(leak()).toBe('original')
})
