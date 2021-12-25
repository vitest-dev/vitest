import { describe, expect, it, vi } from 'vitest'
import axios from 'axios'

// Should not be mocked by axios.test.ts
describe('Calling vi.mock over Axios', () => {
  it('Mock get, post...', () => {
    expect(vi.isMockFunction(axios.get)).toBe(false)
    expect(vi.isMockFunction(axios.post)).toBe(false)
    expect(vi.isMockFunction(axios.put)).toBe(false)
  })
})
