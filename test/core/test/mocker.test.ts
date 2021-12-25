import { expect, it } from 'vitest'
import { createMocker } from '../../../packages/ui/node_modules/vitest/src/node/mocker'

it('Should not mock empty object', () => {
  const mocker = createMocker('root', {})
  const objectToMock = {}

  const item = mocker.mockObject(objectToMock)

  expect(item).toEqual({})
})

it('Should not mock object with primitive values', () => {
  const mocker = createMocker('root', {})
  const objectToMock = {
    item: 'anItem',
    aBoolean: true,
    aNumber: 1,
  }

  const item = mocker.mockObject(objectToMock)

  expect(item).toEqual({
    item: 'anItem',
    aBoolean: true,
    aNumber: 1,
  })
})

it('Should mock attribute with a function', () => {
  const mocker = createMocker('root', {})
  const objectToMock = {
    myFn: () => {},
  }

  const item = mocker.mockObject(objectToMock)

  expect(item).toEqual({
    myFn: expect.any(Function),
  })
  expect(item.myFn.mockClear).toBeDefined()
})

it('Should mock nested attribute with a function', () => {
  const mocker = createMocker('root', {})
  const objectToMock = {
    myAttr: {
      myFn: () => {},
    },
  }

  const item = mocker.mockObject(objectToMock)

  expect(item).toEqual({
    myAttr: {
      myFn: expect.any(Function),
    },
  })
  expect(item.myAttr.myFn.mockClear).toBeDefined()
})

it('Should mock function exported as a default with functions attributes', () => {
  // Ex axios
  // module.exports = axios
  // module.exports.default = axios
  const mocker = createMocker('root', {})
  const fn = () => {}
  fn.get = () => {}
  const objectToMock = {
    default: fn,
  }

  const item = mocker.mockObject(objectToMock)

  expect(item.default).toBeDefined()
  expect(item.default.get.mockClear).toBeDefined()
})
