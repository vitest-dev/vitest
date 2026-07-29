import { expect, it } from 'vitest'
import { CalledB, circularA } from '../src/circularA'

it('circular', () => {
  CalledB.length = 0

  circularA()

  expect(CalledB.length).toBe(1)

  circularA()
  circularA()

  expect(CalledB).toEqual([0, 1, 2])
})
