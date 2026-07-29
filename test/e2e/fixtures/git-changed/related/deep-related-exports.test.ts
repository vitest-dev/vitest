import { access } from 'node:fs'
import { sep } from 'pathe'
import { expect, test } from 'vitest'
import { A } from './src/sourceC'

test('values', () => {
  expect(A).toBe('A')
  expect(typeof sep).toBe('string')
  // doesn't throw
  expect(typeof access).toBe('function')
})
