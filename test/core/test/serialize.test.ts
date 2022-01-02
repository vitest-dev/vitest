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
})

describe('Process Error', () => {
  it('Do not add expected/actual attributes in a object when any of both attributes does not exists', () => {
    const error = new Error('Ops something went wrong')

    const result = processError(error)

    expect(result.expected).not.toBeDefined()
    expect(result.actual).not.toBeDefined()
  })
})
