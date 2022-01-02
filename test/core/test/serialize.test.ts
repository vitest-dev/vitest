import { describe, expect, it } from 'vitest'
import { processError, serializeError } from '../../../packages/vitest/src/runtime/error'

describe('error serialize', () => {
  it('works', () => {
    expect(serializeError(undefined)).toEqual(undefined)
    expect(serializeError(null)).toEqual(null)
    expect(serializeError('hi')).toEqual('hi')

    expect(serializeError({
      foo: 'hi',
      promise: new Promise(() => {}),
      fn: () => {},
      null: null,
      nested: {
        false: false,
        class: class {},
      },
      // Intentionally test with a sparse array to verify it remains sparse during serialization.
      // eslint-disable-next-line no-sparse-arrays
      array: [1,, 3],
    })).toMatchSnapshot()
  })

  it('Should skip circular references to prevent hit the call stack limit', () => {
    const error: Record<string, any> = {
      toString: () => {
        return 'ops something went wrong'
      },
    }
    error.whatever = error
    error.whateverArray = [error, error]
    error.whateverArrayClone = error.whateverArray

    expect(serializeError(error)).toMatchSnapshot()
  })

  it('Should handle object with getter/setter correctly', () => {
    const user = {
      name: 'John',
      surname: 'Smith',

      get fullName() {
        return `${this.name} ${this.surname}`
      },
      set fullName(value) {
        [this.name, this.surname] = value.split(' ')
      },
    }

    expect(serializeError(user)).toEqual({
      name: 'John',
      surname: 'Smith',
      fullName: 'John Smith',
    })
  })

  it('Should copy the full prototype chain including non-enumerable properties', () => {
    const user = {
      name: 'John',
      surname: 'Smith',
    }
    Object.setPrototypeOf(user, {
      name: 'Mr',
      base: true,
    })

    Object.defineProperty(user, 'fullName', { enumerable: false, value: 'John Smith' })

    const serialized = serializeError(user)
    expect(serialized).not.toBe(user)
    expect(serialized).toEqual({
      name: 'John',
      surname: 'Smith',
      fullName: 'John Smith',
      base: true,
    })
  })

  it('Should not retain the constructor of an object', () => {
    // https://github.com/vitest-dev/vitest/issues/374
    // Objects with `Error` constructors appear to cause problems during worker communication using
    // `MessagePort`, so the serialized error object should have been recreated as plain object.
    const error = new Error('test')

    const serialized = serializeError(error)
    expect(Object.getPrototypeOf(serialized)).toBe(null)
    expect(serialized).toEqual({
      constructor: 'Function<Error>',
      name: 'Error',
      message: 'test',
      stack: expect.any(String),
      toString: 'Function<toString>',
    })
  })
})

describe('Process Error', () => {
  it('Do not add expected/actual attributes in a object when any of both attributes does not exists', () => {
    const error = new Error('Ops something went wrong')

    const result = processError(error)

    expect(result.expected).not.toBeDefined()
    expect(result.actual).not.toBeDefined()
  })
})
