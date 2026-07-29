import { expect } from 'vitest'
import { readCoverageMap, runVitest, test } from '../utils'

test('browser coverage works when browser api write and exec are disabled', async () => {
  await runVitest({
    api: {
      allowExec: false,
      allowWrite: false,
    },
    include: ['fixtures/test/math.test.ts'],
    coverage: {
      reporter: 'json',
      include: ['fixtures/src/math.ts'],
    },
  })

  const coverageMap = await readCoverageMap()
  const fileCoverages = coverageMap.files().map(file => coverageMap.fileCoverageFor(file))

  expect(fileCoverages).toMatchInlineSnapshot(`
    {
      "<process-cwd>/fixtures/src/math.ts": {
        "branches": "0/0 (100%)",
        "functions": "1/4 (25%)",
        "lines": "1/4 (25%)",
        "statements": "1/4 (25%)",
      },
    }
  `)
})
