import { expect, test } from 'vitest'

// @ts-expect-error - readonly symbol, but might not be assigned
Symbol.dispose ??= Symbol('dispose')

function resourceful(resourceDefault: string) {
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
  // eslint-disable-next-line no-lone-blocks
  {
    using resource = resourceful('foo')
    getResource = () => resource.resource
  }
  expect(getResource()).toBe(null)
})
