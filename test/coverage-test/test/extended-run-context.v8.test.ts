import { expect } from 'vitest'
import { readCoverageMap, runVitest, test } from '../utils'

test('{ trackProcessAndWorker: true } includes files from child process', async () => {
  await runVitest({
    include: ['fixtures/test/child-process.test.ts'],
    coverage: {
      trackProcessAndWorker: true,
      reporter: ['json', 'html'],
    },
  })
  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  expect(files).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/math.ts",
      "<process-cwd>/fixtures/src/start-fork-and-thread.ts",
      "<process-cwd>/fixtures/src/worker-or-process.ts",
    ]
  `)

  /* See {@link file://./../fixtures/src/worker-or-process.ts} */
  const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/worker-or-process.ts')
  const lines = fileCoverage.getLineCoverage()

  expect(lines[25]).toBe(1)
  expect(lines[37]).toBe(0)
  expect(lines[44]).toBe(0)
})

test('{ trackProcessAndWorker: true } includes files from worker thread', async () => {
  await runVitest({
    include: ['fixtures/test/worker-thread.test.ts'],
    coverage: {
      trackProcessAndWorker: true,
      reporter: ['json', 'html'],
    },
  })
  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  expect(files).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/math.ts",
      "<process-cwd>/fixtures/src/start-fork-and-thread.ts",
      "<process-cwd>/fixtures/src/worker-or-process.ts",
    ]
  `)

  /* See {@link file://./../fixtures/src/worker-or-process.ts} */
  const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/worker-or-process.ts')
  const lines = fileCoverage.getLineCoverage()

  expect(lines[25]).toBe(0)
  expect(lines[37]).toBe(1)
  expect(lines[44]).toBe(0)
})
test.todo('{ trackProcessAndWorker: false } does not include files from child process or worker thread')

test.todo('{ trackProcessAndWorker: true } includes files from process inside process')
test.todo('{ trackProcessAndWorker: true } includes files from worker inside worker')
