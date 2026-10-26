import { expect, test } from 'vitest'
import { late } from '../src/late'

test('the original module is imported first', () => {
  expect(late()).toBe('original')
})
