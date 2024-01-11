import { describe, expect, it } from 'vitest'

describe('exec-args', async () => {
  it('should have the correct flags', () => {
    // flags that should go through
    expect(process.execArgv).toContain('--cpu-prof')
    expect(process.execArgv).toContain('--cpu-prof-name=cpu.prof')
    expect(process.execArgv).toContain('--heap-prof')
    expect(process.execArgv).toContain('--heap-prof-name=heap.prof')
    expect(process.execArgv).toContain('--diagnostic-dir=/tmp/vitest-diagnostics')

    // added via vitest
    expect(process.execArgv).toContain('--conditions')
    expect(process.execArgv).toContain('node')
  })
})
