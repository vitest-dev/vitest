import { describe, expect, it } from 'vitest'

describe('exec-args', async () => {
  it('should have the correct flags', () => {
    expect(process.execArgv).toContain('--hash-seed=1')
    expect(process.execArgv).toContain('--random-seed=1')
    expect(process.execArgv).toContain('--no-opt')

    // added via vitest
    expect(process.execArgv).toContain('--conditions')
    expect(process.execArgv).toContain('node')
  })
})
