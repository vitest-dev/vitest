import { act, renderHook } from '@testing-library/react'
import { useCounter } from './useCounter'

// TODO: implement this without using react testing library
describe('useCounter', () => {
  it('should increment counter', () => {
    const { result } = renderHook(() => useCounter())
    act(() => {
      result.current.increment()
    })
    expect(result.current.count).toBe(1)
  })
})
