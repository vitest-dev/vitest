import { expect, test } from 'vitest'
import { run } from '../src/timer-example'

test('sum', () => {
  run()

  expect(1 + 1).toBe(2)
})

test('multiply', () => {
  expect(1 * 2).toBe(2)
})
