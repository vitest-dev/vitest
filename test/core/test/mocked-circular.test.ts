import { expect, it, vi } from 'vitest'
// The order of the two imports here matters: B before A
import { circularB } from '../src/circularB'
import { circularA } from '../src/circularA'

vi.mock('../src/circularB')

it('circular', () => {
  circularA()

  expect(circularB).toHaveBeenCalledOnce()
})
