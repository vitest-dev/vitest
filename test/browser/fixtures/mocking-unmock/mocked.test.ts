import { expect, test } from 'vitest'
import { source as automocked } from './src/setup-automock'
import { source as factory } from './src/setup-factory'

test('modules mocked in the setup file are mocked', () => {
  expect(automocked()).toBeUndefined()
  expect(factory()).toBe('factory')
})
