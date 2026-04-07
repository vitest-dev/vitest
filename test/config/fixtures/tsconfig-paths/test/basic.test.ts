import { expect, test } from 'vitest'
import { greet } from '#/services/foo'
import { capitalize } from '@/utils'

test('tsconfig paths with # alias', () => {
  expect(greet('world')).toBe('Hello, world!')
})

test('tsconfig paths with @ alias', () => {
  expect(capitalize('hello')).toBe('Hello')
})
