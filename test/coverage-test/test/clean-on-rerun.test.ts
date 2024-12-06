import { readFileSync, writeFileSync } from 'node:fs'
import { beforeEach, expect } from 'vitest'
import { readCoverageMap, runVitest, test } from '../utils'

const FIXTURE = 'fixtures/test/clean-on-rerun-fixture.test.ts'

beforeEach(() => {
  const original = readFileSync(FIXTURE, 'utf8')
  return () => writeFileSync(FIXTURE, original, 'utf8')
})

test('{ cleanOnReRun: false } should invalidate and preserve previous coverage', async () => {
  const { waitForRun } = await startWatchMode({ cleanOnRerun: false })

  // Initially only "sum" should be covered
  expect(await getFunctionCoverageCounts('math.ts')).toMatchInlineSnapshot(`
    {
      "sum": 1,
    }
  `)
  expect(await getFunctionCoverageCounts('even.ts')).toMatchInlineSnapshot(`
    {
      "isEven": 1,
    }
  `)
  expect(await getReportedFiles()).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/even.ts",
      "<process-cwd>/fixtures/src/math.ts",
      "<process-cwd>/fixtures/src/untested-file.ts",
    ]
  `)

  // Change test file to cover "multiply" only
  await waitForRun(() => editTestFile('multiply'))

  // Sum should not be covered. Multiply should be.
  expect(await getFunctionCoverageCounts('math.ts')).toMatchInlineSnapshot(`
    {
      "multiply": 1,
    }
  `)
  // Results of non-changed file should preserve
  expect(await getFunctionCoverageCounts('even.ts')).toMatchInlineSnapshot(`
    {
      "isEven": 1,
    }
  `)
  // Untested file should still be in the report
  expect(await getReportedFiles()).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/even.ts",
      "<process-cwd>/fixtures/src/math.ts",
      "<process-cwd>/fixtures/src/untested-file.ts",
    ]
  `)

  // Change test file to cover "subtract" only
  await waitForRun(() => editTestFile('subtract'))

  // Sum and multiply should not be covered. Subtract should be.
  expect(await getFunctionCoverageCounts('math.ts')).toMatchInlineSnapshot(`
    {
      "subtract": 1,
    }
  `)
  // Results of non-changed file should preserve
  expect(await getFunctionCoverageCounts('even.ts')).toMatchInlineSnapshot(`
    {
      "isEven": 1,
    }
  `)
  // Untested file should still be in the report
  expect(await getReportedFiles()).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/even.ts",
      "<process-cwd>/fixtures/src/math.ts",
      "<process-cwd>/fixtures/src/untested-file.ts",
    ]
  `)
})

test('{ cleanOnReRun: true } remove previous coverage results', async () => {
  const { waitForRun } = await startWatchMode({ cleanOnRerun: true })

  // Initially only "sum" should be covered
  expect(await getFunctionCoverageCounts('math.ts')).toMatchInlineSnapshot(`
    {
      "sum": 1,
    }
  `)
  // All files should be in report
  expect(await getReportedFiles()).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/even.ts",
      "<process-cwd>/fixtures/src/math.ts",
      "<process-cwd>/fixtures/src/untested-file.ts",
    ]
  `)

  // Change test file to cover "multiply" only
  await waitForRun(() => editTestFile('multiply'))

  // Sum should not be covered. Multiply should be.
  expect(await getFunctionCoverageCounts('math.ts')).toMatchInlineSnapshot(`
    {
      "multiply": 1,
    }
  `)
  // Previous results should be removed, only math.ts should be present in report
  expect(await getReportedFiles()).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/math.ts",
    ]
  `)
})

async function startWatchMode(options: { cleanOnRerun: boolean }) {
  const { vitest, ctx } = await runVitest({
    watch: true,
    include: [FIXTURE, 'fixtures/test/even.test.ts'],
    coverage: {
      include: [
        'fixtures/src/math.ts',
        'fixtures/src/even.ts',
        'fixtures/src/untested-file.ts',
      ],
      reporter: 'json',
      ...options,
    },
  })

  async function waitForRun(method: () => void) {
    vitest.resetOutput()
    method()
    await vitest.waitForStdout('1 passed')
    await ctx?.runningPromise
  }

  return { waitForRun }
}

async function getFunctionCoverageCounts(file: 'math.ts' | 'even.ts') {
  const coverageMap = await readCoverageMap()
  const fileCoverage = coverageMap.fileCoverageFor(`<process-cwd>/fixtures/src/${file}`)

  return Object.entries(fileCoverage.fnMap).reduce((total, [key, data]) => ({
    ...total,
    ...(fileCoverage.f[key] ? { [data.name]: fileCoverage.f[key] } : {}),

  }), {} as Record<'sum' | 'subtract' | 'multiply' | 'remainder', number>)
}

async function getReportedFiles() {
  const coverageMap = await readCoverageMap()
  return coverageMap.files()
}

function editTestFile(method: 'sum' | 'subtract' | 'multiply' | 'remainder') {
  let content = readFileSync(FIXTURE, 'utf8')
  content = content.replace(/(const methodToTest = )'(.*)'/, `$1'${method}'`)
  writeFileSync(FIXTURE, content, 'utf8')
}
