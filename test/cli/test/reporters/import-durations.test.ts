import { stripVTControlCharacters } from 'node:util'
import { runVitest } from '#test-utils'
import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'

/**
 * Extract import durations section and normalize variable values for snapshot testing.
 * Replaces timing values and bar characters with placeholders.
 */
function normalizeImportDurationsOutput(stdout: string): string {
  const plain = stripVTControlCharacters(stdout)
  const start = plain.indexOf('Import Duration Breakdown')
  const end = plain.indexOf('Total import time (self/total):')
  if (start === -1 || end === -1) {
    return ''
  }
  const endOfLine = plain.indexOf('\n', end)
  const section = plain.slice(start, endOfLine === -1 ? undefined : endOfLine)
  return section
    // Normalize time values (e.g., "88ms", "1.01s") to "XXX"
    // Negative lookahead to avoid matching times in filenames (e.g., "import-durations-50ms.ts")
    .replace(/\d+(\.\d+)?(ms|s)(?![\w.])/g, 'XXX')
    // Normalize bar characters to "[BAR]"
    .replace(/[█░]+/g, '[BAR]')
    // Normalize multiple spaces (from column padding) to single space
    .replace(/ {2,}/g, ' ')
}

describe('import durations', () => {
  const root = resolve(import.meta.dirname, '..', '..', 'fixtures', 'reporters')

  it('should populate importDurations on File with import durations during execution', async () => {
    const { exitCode, ctx, stderr } = await runVitest({
      root,
      include: ['**/import-durations.test.ts'],
      experimental: { importDurations: { limit: 10 } },
    })

    expect(exitCode, `Expected exit code 0 but got ${exitCode}. stderr: ${stderr}`).toBe(0)

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

    expect(normalizeImportDurationsOutput(stdout)).toMatchInlineSnapshot(`
      "Import Duration Breakdown (Top 5)

      Module Self Total
      import-durations.test.ts XXX XXX [BAR]
      import-durations-50ms.ts XXX XXX [BAR]
      import-durations-25ms.ts XXX XXX [BAR]
      ../../../../packages/vitest/dist/index.js XXX XXX [BAR]

      Total imports: 4
      Slowest import (total-time): XXX
      Total import time (self/total): XXX / XXX"
    `)
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
    // With high threshold (500ms), should NOT print (imports are ~75-120ms depending on CI)
    const { stdout: stdoutHigh } = await runVitest({
      root,
      include: ['**/import-durations.test.ts'],
      experimental: {
        importDurations: {
          print: 'on-warn',
          thresholds: { warn: 500 },
        },
      },
    })

    expect(stdoutHigh).not.toContain('Import Duration Breakdown')

    // With lower threshold (50ms), should print (imports are ~75ms > 50ms)
    const { stdout: stdoutLow } = await runVitest({
      root,
      include: ['**/import-durations.test.ts'],
      experimental: {
        importDurations: {
          print: 'on-warn',
          thresholds: { warn: 50 },
        },
      },
    })

    expect(stdoutLow).toContain('Import Duration Breakdown')
  })

  it('should fail when failOnDanger is enabled and threshold exceeded', async () => {
    // With default danger threshold (500ms), should NOT fail (imports are ~75ms)
    const { exitCode: exitCodeDefault, stderr: stderrDefault } = await runVitest({
      root,
      include: ['**/import-durations.test.ts'],
      experimental: {
        importDurations: {
          failOnDanger: true,
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
          thresholds: { danger: 50 },
        },
      },
    })

    expect(exitCodeLow).toBe(1)
    expect(stderrLow).toContain('exceeded the danger threshold')
    expect(stdoutLow).toContain('Import Duration Breakdown')
  })
})
