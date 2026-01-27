import { runVitest } from '#test-utils'
import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'

describe('import durations', () => {
  const root = resolve(import.meta.dirname, '..', '..', 'fixtures', 'reporters')

  it('should populate importDurations on File with import durations during execution', async () => {
    const { exitCode, ctx } = await runVitest({
      root,
      include: ['**/import-durations.test.ts'],
      experimental: { importDurations: { limit: 10 } },
    })

    expect(exitCode).toBe(0)

    const capturedFiles = ctx!.state.getFiles()

    expect(capturedFiles).toHaveLength(1)

    const file = capturedFiles[0]

    expect(file.importDurations).toBeDefined()

    // The main file should be >=75ms because 50ms+25ms
    expect(file.importDurations?.[file.filepath]?.totalTime).toBeGreaterThanOrEqual(75)

    // The 50ms file imports the 25ms file, so the self time should be >=50ms and the total time should be >=75ms
    const utilsFile = resolve(root, 'import-durations-50ms.ts')

    expect(file.importDurations?.[utilsFile]?.selfTime).toBeGreaterThanOrEqual(49)
    expect(file.importDurations?.[utilsFile]?.totalTime).toBeGreaterThanOrEqual(74)

    // The 25ms file should have a self time >25ms and a total time >25ms
    const helperFile = resolve(root, 'import-durations-25ms.ts')

    expect(file.importDurations?.[helperFile]?.selfTime).toBeGreaterThanOrEqual(24)
    expect(file.importDurations?.[helperFile]?.totalTime).toBeGreaterThanOrEqual(24)
  }, 40000)

  it('should handle tests with no imports gracefully', async () => {
    const { exitCode, ctx } = await runVitest({
      root,
      include: ['**/ok.test.ts'],
      experimental: { importDurations: { limit: 10 } },
    })

    expect(exitCode).toBe(0)

    const capturedFiles = ctx!.state.getFiles()

    expect(capturedFiles).toHaveLength(1)

    const file = capturedFiles[0]
    expect(file.importDurations).toBeDefined()
    expect(file.importDurations?.[file.filepath].totalTime).toBeGreaterThanOrEqual(0)
    expect(file.importDurations?.[file.filepath].selfTime).toBeGreaterThanOrEqual(0)
  }, 40000)

  it('should still record times for throwing imports', async () => {
    const { exitCode, ctx } = await runVitest({
      root,
      include: ['**/import-durations-throws.test.ts'],
      experimental: { importDurations: { limit: 10 } },
    })

    expect(exitCode).toBe(1)

    const capturedFiles = ctx!.state.getFiles()

    expect(capturedFiles).toHaveLength(1)

    const file = capturedFiles[0]

    const throwsFile = resolve(root, 'import-durations-25ms-throws.ts')

    expect(file.importDurations?.[throwsFile]?.totalTime).toBeGreaterThanOrEqual(24)
    expect(file.importDurations?.[throwsFile]?.selfTime).toBeGreaterThanOrEqual(24)
  })

  it('should print import breakdown when print is enabled', async () => {
    const { stdout } = await runVitest({
      root,
      include: ['**/import-durations.test.ts'],
      experimental: {
        importDurations: {
          print: true,
          limit: 5,
        },
      },
    })

    expect(stdout).toContain('Import Duration Breakdown')
    expect(stdout).toContain('(ordered by Total Time)')
    expect(stdout).toContain('Total imports:')
    expect(stdout).toContain('(Top 5)')
  })

  it('should not collect importDurations by default', async () => {
    const { ctx } = await runVitest({
      root,
      include: ['**/import-durations.test.ts'],
    })

    const file = ctx!.state.getFiles()[0]
    expect(file.importDurations).toEqual({})
  })

  it('should print on-warn only when threshold exceeded', async () => {
    // With default threshold (100ms), should NOT print (imports are ~75ms)
    const { stdout: stdoutDefault } = await runVitest({
      root,
      include: ['**/import-durations.test.ts'],
      experimental: {
        importDurations: {
          print: 'on-warn',
          limit: 5,
        },
      },
    })

    expect(stdoutDefault).not.toContain('Import Duration Breakdown')

    // With lower threshold (50ms), should print (imports are ~75ms > 50ms)
    const { stdout: stdoutLow } = await runVitest({
      root,
      include: ['**/import-durations.test.ts'],
      experimental: {
        importDurations: {
          print: 'on-warn',
          limit: 5,
          thresholds: { warn: 50 },
        },
      },
    })

    expect(stdoutLow).toContain('Import Duration Breakdown')
  })

  it('should use custom thresholds for coloring', async () => {
    const { stdout } = await runVitest({
      root,
      include: ['**/import-durations.test.ts'],
      experimental: {
        importDurations: {
          print: true,
          limit: 5,
          thresholds: { warn: 10, danger: 30 },
        },
      },
    })

    expect(stdout).toContain('Import Duration Breakdown')
  })

  it('should fail when failOnDanger is enabled and threshold exceeded', async () => {
    // With default danger threshold (500ms), should NOT fail (imports are ~75ms)
    const { exitCode: exitCodeDefault, stderr: stderrDefault } = await runVitest({
      root,
      include: ['**/import-durations.test.ts'],
      experimental: {
        importDurations: {
          failOnDanger: true,
          limit: 5,
        },
      },
    })

    expect(exitCodeDefault).toBe(0)
    expect(stderrDefault).not.toContain('exceeded the danger threshold')

    // With lower danger threshold (50ms), should fail (imports are ~75ms > 50ms)
    const { exitCode: exitCodeLow, stderr: stderrLow, stdout: stdoutLow } = await runVitest({
      root,
      include: ['**/import-durations.test.ts'],
      experimental: {
        importDurations: {
          failOnDanger: true,
          limit: 5,
          thresholds: { danger: 50 },
        },
      },
    })

    expect(exitCodeLow).toBe(1)
    expect(stderrLow).toContain('exceeded the danger threshold')
    // Should also print the breakdown when failing
    expect(stdoutLow).toContain('Import Duration Breakdown')
  })

  it('should print breakdown when failOnDanger triggers even if print is false', async () => {
    const { exitCode, stdout, stderr } = await runVitest({
      root,
      include: ['**/import-durations.test.ts'],
      experimental: {
        importDurations: {
          print: false,
          failOnDanger: true,
          limit: 5,
          thresholds: { danger: 50 },
        },
      },
    })

    expect(exitCode).toBe(1)
    expect(stderr).toContain('exceeded the danger threshold')
    // Should print breakdown even though print is false
    expect(stdout).toContain('Import Duration Breakdown')
  })
})
