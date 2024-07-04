import { expect, it } from 'vitest'

const [version] = process.version.slice(1).split('.')

it.skipIf(Number(version) < 20)('"v" flag in regexp', () => {
  const regexp = /\p{RGI_Emoji}|\P{Mark}\p{Mark}*/gv
  expect('👍🏼👍🏼👍🏼'.match(regexp)).toEqual(['👍🏼', '👍🏼', '👍🏼'])
})

it('decorators work', () => {
  expect(Sut.mocked).toBe(true)
  expect(new Sut()).toBeInstanceOf(Sut)
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

function exampleDecorator(ClassExample: any, context: ClassDecoratorContext): any {
  if (context.kind !== 'class') {
    throw new Error('not a class to decorate')
  }
  ClassExample.mocked = true
  return ClassExample
}

@exampleDecorator
class Sut {
  static mocked = false
}
