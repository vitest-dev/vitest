import { describe, expect, it } from 'vitest'

describe('exec-args', async () => {
  it('should have the correct flags', () => {
    const execArgv = process.execArgv.map((arg) => arg.replace(/\\/g, '/'))
    expect(execArgv).toContain('--inspect-brk')

    // added via vitest
    expect(execArgv).toContain('--experimental-import-meta-resolve')
    expect(execArgv).toContain('--experimental-vm-modules')
    expect(execArgv).toContain('--require')
    expect(execArgv).toContainEqual(expect.stringContaining('/packages/vitest/suppress-warnings.cjs'))
    expect(execArgv).toContain('--conditions')
    expect(execArgv).toContain('node')
  })
})
