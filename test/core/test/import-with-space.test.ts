import { describe, expect, it } from 'vitest'

describe('should import default import from file within folder with space', async () => {
  const util = await import('file:///test/test%20util/helper') // Error: [vite-node] Failed to load /test/test%20dir/util.mjs
  it('should be triggered', () => {
    expect(util.default).toBe('test helper')
  })
})
