import { describe, expect, it } from 'vitest'

import { target } from './target'

describe('target', () => {
  it('passes without registering a mock', () => {
    expect(target).toBe(true)
  })
})
