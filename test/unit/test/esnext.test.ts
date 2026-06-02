import { expect, it } from 'vitest'

const [version] = process.version.slice(1).split('.')

it.skipIf(Number(version) < 20)('"v" flag in regexp', () => {
  const regexp = /\p{RGI_Emoji}|\P{Mark}\p{Mark}*/gv
  expect('👍🏼👍🏼👍🏼'.match(regexp)).toEqual(['👍🏼', '👍🏼', '👍🏼'])
})

it('new "using" feature', () => {
  let getResource = (): any => {
    throw new Error('don\'t call me')
  }
  {
    using resource = resourceful('foo')
    getResource = () => resource.resource
  }
  expect(getResource()).toBe(null)
})

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
