import { expect, it } from 'vitest'
import { rolldownVersion } from 'vitest/node'

it('decorators work', () => {
  // babel decorator seems to have a bug in class static and decorator ordering
  // https://github.com/babel/babel/issues/17875
  expect(Sut.mocked).toBe(!rolldownVersion)
  expect((Sut as any).mockedEasy).toBe(true)
  expect(new Sut()).toBeInstanceOf(Sut)
})
function exampleDecorator(ClassExample: any, context: ClassDecoratorContext): any {
  if (context.kind !== 'class') {
    throw new Error('not a class to decorate')
  }
  ClassExample.mocked = true
  ClassExample.mockedEasy = true
  return ClassExample
}

@exampleDecorator
class Sut {
  static mocked = false
}
