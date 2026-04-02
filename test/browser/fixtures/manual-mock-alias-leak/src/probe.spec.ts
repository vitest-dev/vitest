import { describe, expect, it, vi } from 'vitest'

vi.mock('~/modal', () => ({
  useModalStore() {},
}))

vi.mock('./modal', () => ({
  useModalStore() {},
}))

import { probe } from './probe'

describe('probe', () => {
  it('passes with duplicate manual mocks for the same module', () => {
    expect(probe).toBe(true)
  })
})
