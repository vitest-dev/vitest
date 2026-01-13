import { expect } from 'vitest'
import { readCoverageMap, runVitest, test } from '../utils'

test('coverage results matches snapshot', async () => {
  await runVitest({
    include: ['fixtures/test/math.test.ts', 'fixtures/test/even.test.ts'],
    coverage: {
      reporter: 'json',
      include: [
        'fixtures/src/math.ts',
        'fixtures/src/even.ts',
        'fixtures/src/untested-file.ts',
      ],
    },
  })

  const coverageMap = await readCoverageMap()
  const fileCoverages = coverageMap.files().map(file => coverageMap.fileCoverageFor(file))

  expect(fileCoverages).toMatchInlineSnapshot(`
    {
      "<process-cwd>/fixtures/src/even.ts": {
        "branches": "0/0 (100%)",
        "functions": "1/2 (50%)",
        "lines": "1/2 (50%)",
        "statements": "1/2 (50%)",
      },
      "<process-cwd>/fixtures/src/math.ts": {
        "branches": "0/0 (100%)",
        "functions": "1/4 (25%)",
        "lines": "1/4 (25%)",
        "statements": "1/4 (25%)",
      },
      "<process-cwd>/fixtures/src/untested-file.ts": {
        "branches": "0/2 (0%)",
        "functions": "0/4 (0%)",
        "lines": "0/6 (0%)",
        "statements": "0/6 (0%)",
      },
    }
  `)

  const lineCoverages = coverageMap.files().reduce((all, file) => ({
    [file]: coverageMap.fileCoverageFor(file).getLineCoverage(),
    ...all,
  }), {})

  expect(lineCoverages).toMatchInlineSnapshot(`
    {
      "<process-cwd>/fixtures/src/even.ts": {
        "2": 1,
        "6": 0,
      },
      "<process-cwd>/fixtures/src/math.ts": {
        "10": 0,
        "14": 0,
        "2": 1,
        "6": 0,
      },
      "<process-cwd>/fixtures/src/untested-file.ts": {
        "14": 0,
        "21": 0,
        "33": 0,
        "35": 0,
        "46": 0,
        "9": 0,
      },
    }
  `)
})
