import { expect } from 'vitest'
import { cleanupCoverageJson, readCoverageMap, runVitest, test } from '../utils'

test('enableCoverage() collects coverage after being called', async () => {
  await cleanupCoverageJson()

  // Run a minimal suite where coverage starts disabled, then enable it and rerun.
  const { ctx } = await runVitest({
    include: ['fixtures/test/math.test.ts'],
    coverage: {
      // start disabled and turn on dynamically
      enabled: false,
      reporter: 'json',
      include: [
        'fixtures/src/math.ts',
        'fixtures/src/untested-file.ts',
      ],
    },
  })

  await expect(readCoverageMap(), 'coverage map is not on the disk').rejects.toThrowError(/no such file/)

  await ctx!.enableCoverage()
  expect(ctx!.coverageProvider).toBeTruthy()

  await ctx!.rerunFiles()

  const coverageMap = await readCoverageMap()
  expect(coverageMap.files()).toContain('<process-cwd>/fixtures/src/math.ts')
})

test('disableCoverage() stops collecting coverage going forward', async () => {
  const { ctx } = await runVitest({
    include: ['fixtures/test/math.test.ts'],
    coverage: {
      enabled: true,
      reporter: 'json',
      include: [
        'fixtures/src/math.ts',
        'fixtures/src/untested-file.ts',
      ],
      // try to clean on rerun when provider is enabled
      cleanOnRerun: true,
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

  await expect(readCoverageMap(), 'coverage map is not on the disk').rejects.toThrowError(/no such file/)
  expect(ctx!.coverageProvider).toBeNull()
})
