import { expect, test } from 'vitest'
import { greet } from '../src/end-mapping'

test('greet', () => {
  expect(greet()).toBe('Hello world')
})
