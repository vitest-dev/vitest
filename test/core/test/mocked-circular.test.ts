import { expect, it, vi } from 'vitest'

import { circularA } from '../src/circularA'
// The order of the two imports here matters: B before A
import { circularB } from '../src/circularB'

vi.mock('../src/circularB')

it('circular', () => {
  circularA()

  expect(circularB).toHaveBeenCalledOnce()
})
