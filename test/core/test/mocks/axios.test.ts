import { describe, expect, it, vi } from 'vitest'
import axios from 'axios'

vi.mock('axios')

describe('Calling vi.mock over Axios', () => {
  it('Mock get, post...', () => {
    expect(vi.isMockFunction(axios.get)).toBe(true)
    expect(vi.isMockFunction(axios.post)).toBe(true)
    expect(vi.isMockFunction(axios.put)).toBe(true)
  })
})
