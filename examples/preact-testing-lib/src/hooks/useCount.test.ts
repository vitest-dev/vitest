import { act, renderHook } from '@testing-library/preact'
import { useCount } from './useCount'

describe('useCount hook', () => {
  it('should increment', () => {
    const { result } = renderHook(() => useCount())
    act(() => {
      result.current.inc()
    })
    expect(result.current.count).toBe(1)
  })
})
