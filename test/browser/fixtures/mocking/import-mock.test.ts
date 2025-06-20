import { test, vi, expect } from 'vitest'

vi.mock(import('./src/mocks_factory'), () => {
  return {
    calculator: () => 55,
    mocked: true,
  }
})

test('all mocked are valid', async () => {
  const example = await vi.importMock<typeof import('./src/example')>('./src/example')

  // creates a new mocked function with no formal arguments.
  expect(example.square.name).toEqual('square')
  expect(example.square.length).toEqual(0)

  // async functions get the same treatment as standard synchronous functions.
  expect(example.asyncSquare.name).toEqual('asyncSquare')
  expect(example.asyncSquare.length).toEqual(0)

  // creates a new class with the same interface, member functions and properties are mocked.
  expect(example.someClasses.constructor.name).toEqual('Bar')
  expect(example.someClasses.foo.name).toEqual('foo')
  expect(vi.isMockFunction(example.someClasses.foo)).toBe(true)
  expect(example.someClasses.array.length).toEqual(0)

  // creates a deeply cloned version of the original object.
  expect(example.object).toEqual({
    baz: 'foo',
    bar: {
      fiz: 1,
      buzz: [],
    },
  })

  // creates a new empty array, ignoring the original array.
  expect(example.array.length).toEqual(0)

  // creates a new property with the same primitive value as the original property.
  expect(example.number).toEqual(123)
  expect(example.string).toEqual('baz')
  expect(example.boolean).toEqual(true)
  expect(example.symbol).toEqual(Symbol.for('a.b.c'))
})

test('import from a factory if defined', async () => {
  const { calculator, mocked } = await vi.importMock<typeof import('./src/mocks_factory')>(
    './src/mocks_factory'
  )
  expect(calculator('add', 1, 2)).toBe(55)
  expect(mocked).toBe(true)
})

test('imports from __mocks__', async () => {
  const { calculator } = await vi.importMock<typeof import('./src/mocks_calculator')>(
    './src/mocks_calculator'
  )
  expect(calculator('plus', 1, 2)).toBe(42)
})
