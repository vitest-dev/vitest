import { describe, expect, it } from 'vitest'

describe('jest-matcher-utils', () => {
  expect.extend({
    toBeJestEqual(received: any, expected: any) {
      return {
        message: () => this.utils.diff(expected, received) || '',
        pass: received === expected,
      }
    },
  })

  it('diff', () => {
    let error!: Error
    try {
      // @ts-expect-error "toBeJestEqual" is a custom matcher we just created
      expect('a').toBeJestEqual('b')
      expect.unreachable()
    }
    catch (err: any) {
      error = err
    }
    expect(error.message).toMatch(/- b.*\+ a/s)
  })
})
