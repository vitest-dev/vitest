import { describe, expect, it } from 'vitest'

describe('exec-args', async () => {
  it('should have the correct flags', () => {
    expect(process.execArgv).toContain('--inspect-brk')

    // added via vitest
    expect(process.execArgv).toContain('--experimental-import-meta-resolve')
    expect(process.execArgv).toContain('--experimental-vm-modules')
    expect(process.execArgv).toContain('--require')
    expect(process.execArgv).toContainEqual(expect.stringContaining('/packages/vitest/suppress-warnings.cjs'))
    expect(process.execArgv).toContain('--conditions')
    expect(process.execArgv).toContain('node')
  })
})
