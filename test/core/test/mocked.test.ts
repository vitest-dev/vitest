import { vitest, test, assert, spyOn, expect } from 'vitest'
import { two } from '../src/submodule'
import * as mocked from '../src/mockedA'
import { mockedB } from '../src/mockedB'

vitest.mock('../src/submodule')

test('Math.sqrt()', () => {
  assert.equal(Math.sqrt(4) + 1, two)
})

test('can mock esm', () => {
  const spy = spyOn(mocked, 'mockedA')

  mockedB()

  expect(spy).toHaveBeenCalled()
  expect(spy).toHaveReturnedWith('A')
})
