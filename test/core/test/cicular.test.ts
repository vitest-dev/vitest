import { test, expect } from 'vitest'
import { CalledB, circularA } from '../src/circularA'

test('circular', () => {
  CalledB.length = 0

  circularA()

  expect(CalledB.length).toBe(1)

  circularA()
  circularA()

  expect(CalledB).toEqual([0, 1, 2])
})
