import { expect, it } from 'vitest'
import { timeout } from './timeout'

it('timeout', () => new Promise(resolve => setTimeout(resolve, timeout)))

it('1', () => {
  expect(1).toEqual(1)
})
