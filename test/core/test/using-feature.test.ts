import { test, expect } from 'vitest'

// @ts-expect-error - readonly symbol, but might not be assigned
Symbol.dispose ??= Symbol('dispose')

const resourceful = (resourceDefault: string) => {
  let resource: string | null = resourceDefault
  return {
    get resource() {
      return resource
    },
    [Symbol.dispose]: () => {
      resource = null
    },
  }
}

test('new "using" feature', () => {
  let getResource = (): any => {
    throw new Error('don\'t call me')
  }
  {
    using resource = resourceful('foo')
    getResource = () => resource.resource
  }
  expect(getResource()).toBe(null)
})
