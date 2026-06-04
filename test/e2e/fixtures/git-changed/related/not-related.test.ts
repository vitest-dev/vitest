import { expect, test } from 'vitest'
import { B } from './src/sourceB'

test('shouldn\'t run', () => {
  expect(B).toBe('B')
  expect.fail()
})
