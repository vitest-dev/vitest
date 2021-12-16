import { vitest, test, assert, spyOn, expect } from 'vitest'
import { two } from '../src/submodule'
import * as mocked from '../src/mockedA'
import { mockedB } from '../src/mockedB'

vitest.mock('../src/submodule')

test('submodule is mocked to return "two" as 3', () => {
  assert.equal(3, two)
})

// TODO - works with tinyspy
test.skip('can mock esm', () => {
  const spy = spyOn(mocked, 'mockedA')

  mockedB()

  expect(spy).toHaveBeenCalled()
  expect(spy).toHaveReturnedWith('A')
})
