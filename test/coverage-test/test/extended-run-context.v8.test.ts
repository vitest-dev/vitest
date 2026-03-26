import { expect } from 'vitest'
import { readCoverageMap, runVitest, test } from '../utils'

test('{ trackProcessAndWorker: true } includes files from child process', async () => {
  await runVitest({
    include: ['fixtures/test/child-process.test.ts'],
    coverage: {
      trackProcessAndWorker: true,
      reporter: 'json',
    },
  })
  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  expect(files).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/math.ts",
      "<process-cwd>/fixtures/src/start-fork-and-thread.ts",
      "<process-cwd>/fixtures/src/worker-or-process.js",
      "<process-cwd>/fixtures/src/worker-or-process.pre-transpiled.js",
      "<process-cwd>/fixtures/src/worker-or-process.ts",
      "<process-cwd>/fixtures/src/pre-transpiled/original.ts",
    ]
  `)

  {
    /* See {@link file://./../fixtures/src/worker-or-process.ts} */
    const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/worker-or-process.ts')
    const lines = fileCoverage.getLineCoverage()

    expect.soft(lines[25]).toBe(1)
    expect.soft(lines[37]).toBe(0)
    expect.soft(lines[44]).toBe(0)
  }

  {
    /* See {@link file://./../fixtures/src/worker-or-process.js} */
    const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/worker-or-process.js')
    const lines = fileCoverage.getLineCoverage()

    expect.soft(lines[16]).toBe(1)
    expect.soft(lines[24]).toBe(0)
    expect.soft(lines[29]).toBe(0)
  }

  {
    /* See {@link file://./../fixtures/src/pre-transpiled/original.ts} */
    const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/pre-transpiled/original.ts')
    const lines = fileCoverage.getLineCoverage()

    expect.soft(lines[4]).toBe(0)
    expect.soft(lines[8]).toBe(1)
    expect.soft(lines[12]).toBe(0)
    expect.soft(lines[17]).toBe(1)
  }
})

test('{ trackProcessAndWorker: true } includes files from worker thread', async () => {
  await runVitest({
    include: ['fixtures/test/worker-thread.test.ts'],
    coverage: {
      trackProcessAndWorker: true,
      reporter: 'json',
    },
  })
  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  expect(files).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/math.ts",
      "<process-cwd>/fixtures/src/start-fork-and-thread.ts",
      "<process-cwd>/fixtures/src/worker-or-process.js",
      "<process-cwd>/fixtures/src/worker-or-process.pre-transpiled.js",
      "<process-cwd>/fixtures/src/worker-or-process.ts",
      "<process-cwd>/fixtures/src/pre-transpiled/original.ts",
    ]
  `)

  {
  /* See {@link file://./../fixtures/src/worker-or-process.ts} */
    const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/worker-or-process.ts')
    const lines = fileCoverage.getLineCoverage()

    expect.soft(lines[25]).toBe(0)
    expect.soft(lines[37]).toBe(1)
    expect.soft(lines[44]).toBe(0)
  }

  {
  /* See {@link file://./../fixtures/src/worker-or-process.js} */
    const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/worker-or-process.js')
    const lines = fileCoverage.getLineCoverage()

    expect.soft(lines[16]).toBe(0)
    expect.soft(lines[24]).toBe(1)
    expect.soft(lines[29]).toBe(0)
  }

  {
    /* See {@link file://./../fixtures/src/pre-transpiled/original.ts} */
    const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/pre-transpiled/original.ts')
    const lines = fileCoverage.getLineCoverage()

    expect.soft(lines[4]).toBe(0)
    expect.soft(lines[8]).toBe(1)
    expect.soft(lines[12]).toBe(0)
    expect.soft(lines[17]).toBe(1)
  }
})

test('{ trackProcessAndWorker: false } does not include files from child process or worker thread', async () => {
  await runVitest({
    include: ['fixtures/test/child-process.test.ts', 'fixtures/test/worker-thread.test.ts'],
    coverage: {
      trackProcessAndWorker: false,
      reporter: 'json',
    },
  })
  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  expect(files).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/start-fork-and-thread.ts",
    ]
  `)
})

test.todo('{ trackProcessAndWorker: true } includes files from process inside process')
test.todo('{ trackProcessAndWorker: true } includes files from worker inside worker')
