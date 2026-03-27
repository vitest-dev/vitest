import { describe, expect, it, vi } from 'vitest'

vi.mock('~/manual-repro/modal', () => ({
  useModalStore() {},
}))

vi.mock('./modal', () => ({
  useModalStore() {},
}))

import { probe } from './probe'

describe('manual repro probe', () => {
  it('passes with duplicate manual mocks for the same module', async () => {
    expect(probe).toBe(true)
  })
})
