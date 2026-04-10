import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { BaseCoverageProvider } from 'vitest/node'

test('missing coverage temp directory throws an actionable error', async () => {
  const provider = new BaseCoverageProvider()
  provider.coverageFilesDirectory = resolve('missing-coverage-directory', '.tmp')

  provider.onAfterSuiteRun({
    coverage: { '/src/math.ts': {} },
    environment: 'ssr',
    projectName: '',
    testFiles: ['math.test.ts'],
  } as any)

  await expect(Promise.all(provider.pendingPromises)).rejects.toThrow(
    `Something removed the coverage directory "${provider.coverageFilesDirectory}" Vitest created earlier. Make sure you are not running multiple Vitests with the same "coverage.reportsDirectory" at the same time.`,
  )
})
