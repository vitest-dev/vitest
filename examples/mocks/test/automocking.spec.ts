import type * as exampleModule from '../src/example'
import log from '../src/log'
import { methodSymbol, moduleWithSymbol } from '../src/moduleWithSymbol'

vi.mock('../src/log')
vi.mock('../src/moduleWithSymbol')

test('all mocked are valid', async () => {
  const example = await vi.importMock<typeof exampleModule>('../src/example')

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

test('automock properly restores mock', async () => {
  expect(log.warn()).toBeUndefined()
  expect(moduleWithSymbol.warn()).toBeUndefined()
  expect(moduleWithSymbol[methodSymbol]()).toBeUndefined()

  vi.restoreAllMocks()

  expect(() => {
    log.warn()
  }).not.toThrow()

  expect(moduleWithSymbol[methodSymbol]()).toBe('hello')
  expect(moduleWithSymbol.warn()).toBe('hello')
})
