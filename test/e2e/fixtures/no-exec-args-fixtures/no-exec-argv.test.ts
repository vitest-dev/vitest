import { describe, expect, it } from 'vitest'

describe('exec-args', async () => {
  it('should have the correct flags', () => {
    // flags should not be passed
    expect(process.execArgv).not.toContain('--title')

    // added via vitest
    expect(process.execArgv).toContain('--conditions')
    expect(process.execArgv).toContain('node')
  })
})
