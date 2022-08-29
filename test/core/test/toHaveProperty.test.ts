import { expect, it } from 'vitest'

const obj = {
  'a-b': true,
  'a-b-1.0.0': true,
}

it('should have key', () => {
  expect(obj).toHaveProperty('a-b')
  expect(obj).toHaveProperty('a-b-1.0.0')
})
