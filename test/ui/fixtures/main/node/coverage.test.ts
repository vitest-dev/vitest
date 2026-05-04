import { expect, it } from 'vitest'
import { multiply } from './coverage'

it(multiply, () => {
  expect(multiply(2, 3)).toEqual(6)
})
