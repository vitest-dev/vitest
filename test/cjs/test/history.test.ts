import { createMemoryHistory } from 'history'
import { describe, it, expect } from 'vitest'

describe('history', () => {
  it('should work', () => {
    const history = createMemoryHistory()
    expect(history.location.pathname).toBe('/')
  })
})
