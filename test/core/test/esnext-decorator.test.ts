import { expect, it } from 'vitest'

it('decorators work', () => {
  expect(Sut.mocked).toBe(true)
  expect(new Sut()).toBeInstanceOf(Sut)
})

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
