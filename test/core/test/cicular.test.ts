import { it, expect } from 'vitest'
import { CalledB, circularA } from '../src/circularA'
import { timeout } from '../src/timeout'

it('circular', () => {
  CalledB.length = 0

  circularA()

  expect(CalledB.length).toBe(1)

  circularA()
  circularA()

  expect(CalledB).toEqual([0, 1, 2])
})

it('timeout', () => new Promise(resolve => setTimeout(resolve, timeout)))
