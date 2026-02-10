import { expect, test } from 'vitest'
import { covered } from './repro.js'

test('repro', () => {
  expect(covered()).toBe('hey')
})
