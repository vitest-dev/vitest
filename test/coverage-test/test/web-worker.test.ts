import { expect } from 'vitest'
import { formatSummary, readCoverageMap, runVitest, test } from '../utils'

test('web worker coverage is correct', async () => {
  await runVitest({
    setupFiles: ['@vitest/web-worker'],
    include: ['fixtures/test/web-worker.test.ts'],
    environment: 'jsdom',
    coverage: {
      include: [
        // Runs in web-worker's runner with custom context -> execution wrapper ~430 chars
        'fixtures/src/worker.ts',

        // Runs in default runner -> execution wrapper ~185 chars
        'fixtures/src/worker-wrapper.ts',
      ],
      reporter: 'json',
    },
  })

  const coverageMap = await readCoverageMap()
  const worker = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/worker.ts')
  const wrapper = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/worker-wrapper.ts')

  const summary = {
    [worker.path]: formatSummary(worker.toSummary()),
    [wrapper.path]: formatSummary(wrapper.toSummary()),
  }

  // Check HTML report if these change unexpectedly
  expect(summary).toMatchInlineSnapshot(`
    {
      "<process-cwd>/fixtures/src/worker-wrapper.ts": {
        "branches": "0/0 (100%)",
        "functions": "3/5 (60%)",
        "lines": "9/11 (81.81%)",
        "statements": "9/11 (81.81%)",
      },
      "<process-cwd>/fixtures/src/worker.ts": {
        "branches": "2/4 (50%)",
        "functions": "2/3 (66.66%)",
        "lines": "7/12 (58.33%)",
        "statements": "7/12 (58.33%)",
      },
    }
  `)
})
