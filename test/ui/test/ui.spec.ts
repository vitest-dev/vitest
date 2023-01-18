import { beforeAll, expect, it } from 'vitest'
import { browserErrors } from '../setup'

// setup ui
beforeAll(async () => {
})

it('should load ui', () => {

})

it('should no error in ui', () => {
  expect(browserErrors.length).toEqual(0)
})
