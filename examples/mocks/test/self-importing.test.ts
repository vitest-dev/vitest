import zustand from 'zustand'

vi.mock('zustand')

describe('zustand didn\'t go into an infinite loop', () => {
  test('zustand is mocked', () => {
    expect(vi.isMockFunction(zustand)).toBe(true)
  })
})
