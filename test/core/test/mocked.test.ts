import { assert, expect, test, vi, vitest } from 'vitest'
// @ts-expect-error not typed module
import { value as virtualValue } from 'virtual-module'
import { two } from '../src/submodule'
import * as mocked from '../src/mockedA'
import { mockedB } from '../src/mockedB'
import * as globalMock from '../src/global-mock'

vitest.mock('../src/submodule')
vitest.mock('virtual-module', () => {
  return { value: 'mock' }
})

test('submodule is mocked to return "two" as 3', () => {
  assert.equal(3, two)
})

test('globally mocked files are mocked', () => {
  expect(globalMock.mocked).toBe(true)
})

test('can mock esm', () => {
  const spy = vi.spyOn(mocked, 'mockedA')

  mockedB()

  expect(spy).toHaveBeenCalled()
  expect(spy).toHaveReturnedWith('A')
})

test('mocked exports should override original exports', () => {
  expect(virtualValue).toBe('mock')
})
