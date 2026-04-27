import { describe, expect, it } from 'vitest';

describe('describe error', () => {
  throw new Error('describe error')

  it('wont run', () => {
    expect(true).toBe(true)
  })
})