import { describe, expect, it, vi } from 'vitest'

describe('toHaveBeenCalledBefore', () => {
  it('does not accept a number as failIfNoFirstInvocation', () => {
    const resultMock = vi.fn()

    resultMock()

    // @ts-expect-error failIfNoFirstInvocation must be boolean, not number
    expect(vi.fn()).toHaveBeenCalledBefore(resultMock, 0)
  })
})

describe('toHaveBeenCalledAfter', () => {
  it('does not accept a number as failIfNoFirstInvocation', () => {
    const expectMock = vi.fn()

    expectMock()

    // @ts-expect-error failIfNoFirstInvocation must be boolean, not number
    expect(expectMock).toHaveBeenCalledAfter(vi.fn(), 0)
  })
})
