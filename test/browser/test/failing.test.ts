import { expect, it } from 'vitest'
import { throwError } from '../src/error'

it('correctly fails and prints a diff', () => {
  expect(1).toBe(2)
})

it('correctly print error in another file', () => {
  throwError()
})
