import { getDefaultColors, setupColors } from '@vitest/utils'
import { describe, expect, it } from 'vitest'

describe('jest-matcher-utils', () => {
  expect.extend({
    toBeJestEqual(received: any, expected: any) {
      return {
        message: () => this.utils.diff(received, expected),
        pass: received === expected,
      }
    },
  })

  it('diff', () => {
    setupColors(getDefaultColors())

    expect(() => {
      // @ts-expect-error "toBeJestEqual" is a custom matcher we just created
      expect('a').toBeJestEqual('b')
    }).toThrowError(/- 'b'.*\+ 'a'/ms)
  })
})
