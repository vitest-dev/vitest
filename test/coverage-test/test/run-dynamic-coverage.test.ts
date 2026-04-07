import { expect } from 'vitest'
import { cleanupCoverageJson, readCoverageMap, runVitest, test } from '../utils'

test('enableCoverage() collects coverage after being called', async () => {
  await cleanupCoverageJson()

  // Run a minimal suite where coverage starts disabled, then enable it and rerun.
  const { ctx } = await runVitest({
    include: ['fixtures/test/math.test.ts'],
    watch: true,
    coverage: {
      // start disabled and turn on dynamically
      enabled: false,
      reporter: 'json',
    },
  })

  await expect(readCoverageMap(), 'coverage map should not be on the disk').rejects.toThrow(/no such file/)

  await ctx!.enableCoverage()
  expect(ctx!.coverageProvider).toBeTruthy()

  await ctx!.rerunFiles()

  const coverageMap = await readCoverageMap()
  expect(coverageMap.files()).toContain('<process-cwd>/fixtures/src/math.ts')
})

test('enableCoverage() invalidates circular modules', async () => {
  await cleanupCoverageJson()

  await expect(readCoverageMap(), 'coverage map should not be on the disk').rejects.toThrow(/no such file/)

  // Simulating user actions in the VSCode Vitest extension:
  // 1. User clicks "Run Test with Coverage" to generate coverage files normally
  const { ctx } = await runVitest({
    include: ['fixtures/test/circular.test.ts'],
    watch: false,
    coverage: {
      enabled: true,
      reporter: 'json',
    },
  })

  const coverageMap = await readCoverageMap()
  expect(coverageMap.files()).toEqual([
    '<process-cwd>/fixtures/src/circularA.ts',
    '<process-cwd>/fixtures/src/circularB.ts',
  ])

  // 2. User reruns tests with coverage
  await ctx!.enableCoverage()
  await ctx!.rerunFiles()

  const coverageMap2 = await readCoverageMap()
  expect(coverageMap2.files()).toEqual([
    '<process-cwd>/fixtures/src/circularA.ts',
    '<process-cwd>/fixtures/src/circularB.ts',
  ])
})

test('disableCoverage() stops collecting coverage going forward', async () => {
  const { ctx } = await runVitest({
    include: ['fixtures/test/math.test.ts'],
    watch: true,
    coverage: {
      enabled: true,
      reporter: 'json',
    },
  })

  // Initial run collects coverage
  const initialMap = await readCoverageMap()
  expect(initialMap.files()).toContain('<process-cwd>/fixtures/src/math.ts')
  expect(ctx!.coverageProvider).toBeTruthy()

  // Disable coverage and rerun
  ctx!.disableCoverage()
  expect(ctx!.coverageProvider).toBeNull()

  await cleanupCoverageJson()

  await ctx!.rerunFiles()

  await expect(readCoverageMap(), 'coverage map should not be on the disk').rejects.toThrow(/no such file/)
  expect(ctx!.coverageProvider).toBeNull()
})
