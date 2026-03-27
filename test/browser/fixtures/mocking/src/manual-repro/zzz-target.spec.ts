import { describe, expect, it } from 'vitest'
import { target } from './target'

describe('manual repro target', () => {
  it('passes without registering a mock', async () => {
    expect(target).toBe(true)
  })
})
