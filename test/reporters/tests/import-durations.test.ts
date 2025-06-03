import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

describe('import durations', () => {
  const root = resolve(__dirname, '..', 'fixtures')

  it('should populate importDurations on File with import durations during execution', async () => {
    const { exitCode, ctx } = await runVitest({
      root,
      include: ['**/import-durations.test.ts'],
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

    expect(file.importDurations?.[utilsFile]?.selfTime).toBeGreaterThanOrEqual(50)
    expect(file.importDurations?.[utilsFile]?.totalTime).toBeGreaterThanOrEqual(75)

    // The 25ms file should have a self time >25ms and a total time >25ms
    const helperFile = resolve(root, 'import-durations-25ms.ts')

    expect(file.importDurations?.[helperFile]?.selfTime).toBeGreaterThanOrEqual(25)
    expect(file.importDurations?.[helperFile]?.totalTime).toBeGreaterThanOrEqual(25)
  }, 40000)

  it('should handle tests with no imports gracefully', async () => {
    const { exitCode, ctx } = await runVitest({
      root,
      include: ['**/ok.test.ts'],
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
    })

    expect(exitCode).toBe(1)

    const capturedFiles = ctx!.state.getFiles()

    expect(capturedFiles).toHaveLength(1)

    const file = capturedFiles[0]

    const throwsFile = resolve(root, 'import-durations-25ms-throws.ts')

    expect(file.importDurations?.[throwsFile]?.totalTime).toBeGreaterThanOrEqual(24)
    expect(file.importDurations?.[throwsFile]?.selfTime).toBeGreaterThanOrEqual(24)
  })
})
