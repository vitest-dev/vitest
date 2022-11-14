import { describe, expect, it } from 'vitest'
import format from '../src/default-function.cjs'

describe('correctly puts default on default', () => {
  it('works on default function', () => {
    expect(format()).toBe('')
  })

  it('works on nested default function', () => {
    // @ts-expect-error types defined only default
    expect(format.default()).toBe('')
  })
})
