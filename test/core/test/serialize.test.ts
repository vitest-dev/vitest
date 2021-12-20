import { describe, expect, it } from 'vitest'
import { serializeError } from '../../../packages/vitest/src/runtime/error'

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
})
