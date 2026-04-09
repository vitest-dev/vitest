import { describe, expect } from 'vitest'
import { readCoverageMap, runVitest, test } from '../utils'

const isTypeStrippingSupported = !!process.features.typescript

describe.each(['child process', 'worker thread'] as const)('%s', (runtime) => {
  /* See {@link file://./../fixtures/test/child-process.test.ts} */
  /* See {@link file://./../fixtures/test/worker-thread.test.ts} */
  const filename = `fixtures/test/${runtime.replace(' ', '-')}.test.ts`

  test('{ trackProcessAndWorker: true } typescript source file', async ({ skip }) => {
    skip(isTypeStrippingSupported === false, `Type stripping is not supported in Node ${process.version}`)

    await runVitest({
      include: [filename],
      testNamePattern: `${runtime} typescript`,
      pool: 'forks',
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
        "<process-cwd>/fixtures/src/worker-or-process.ts",
      ]
    `)

    /* See {@link file://./../fixtures/src/worker-or-process.ts} */
    const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/worker-or-process.ts')
    const lines = fileCoverage.getLineCoverage()

    expect.soft(lines[25]).toBe(runtime === 'child process' ? 1 : 0)
    expect.soft(lines[37]).toBe(runtime === 'worker thread' ? 1 : 0)
    expect.soft(lines[44]).toBe(0)

    assertMath(coverageMap)
  })

  test('{ trackProcessAndWorker: true } javascript source file', async () => {
    await runVitest({
      include: [filename],
      testNamePattern: `${runtime} javascript source file`,
      pool: 'forks',
      coverage: {
        trackProcessAndWorker: true,
        reporter: 'json',
      },
    })
    const coverageMap = await readCoverageMap()
    const files = coverageMap.files()

    expect(files).toMatchInlineSnapshot(`
      [
        "<process-cwd>/fixtures/src/math.js",
        "<process-cwd>/fixtures/src/start-fork-and-thread.ts",
        "<process-cwd>/fixtures/src/worker-or-process.js",
      ]
    `)

    {
    /* See {@link file://./../fixtures/src/worker-or-process.js} */
      const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/worker-or-process.js')
      const lines = fileCoverage.getLineCoverage()

      expect.soft(lines[16]).toBe(runtime === 'child process' ? 1 : 0)
      expect.soft(lines[24]).toBe(runtime === 'worker thread' ? 1 : 0)
      expect.soft(lines[29]).toBe(0)
    }

    assertMath(coverageMap, 'js')
  })

  test('{ trackProcessAndWorker: true } pre-transpiled file', async () => {
    await runVitest({
      include: [filename],
      testNamePattern: `(${runtime} transpiled javascript with source maps)`,
      pool: 'forks',
      coverage: {
        trackProcessAndWorker: true,
        reporter: 'json',
      },
    })
    const coverageMap = await readCoverageMap()
    const files = coverageMap.files()

    expect(files).toMatchInlineSnapshot(`
      [
        "<process-cwd>/fixtures/src/start-fork-and-thread.ts",
        "<process-cwd>/fixtures/src/worker-or-process.pre-transpiled.js",
        "<process-cwd>/fixtures/src/pre-transpiled/original.ts",
      ]
    `)

    /* See {@link file://./../fixtures/src/pre-transpiled/original.ts} */
    const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/pre-transpiled/original.ts')
    const lines = fileCoverage.getLineCoverage()

    expect.soft(lines[4]).toBe(0)
    expect.soft(lines[8]).toBe(1)
    expect.soft(lines[12]).toBe(0)
    expect.soft(lines[17]).toBe(1)
  })

  test(`{ trackProcessAndWorker: true } nested ${runtime}'s`, async () => {
    await runVitest({
      include: [filename],
      testNamePattern: `(${runtime} inside ${runtime})`,
      pool: 'forks',
      coverage: {
        trackProcessAndWorker: true,
        reporter: 'json',
      },
    })
    const coverageMap = await readCoverageMap()
    const files = coverageMap.files()

    expect(files).toMatchInlineSnapshot(`
      [
        "<process-cwd>/fixtures/src/math.js",
        "<process-cwd>/fixtures/src/start-fork-and-thread.ts",
        "<process-cwd>/fixtures/src/worker-or-process.nested.js",
      ]
    `)

    assertMath(coverageMap, 'js')
  })

  test('{ trackProcessAndWorker: false }', async () => {
    await runVitest({
      include: [filename],
      pool: 'forks',
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
})

function assertMath(coverageMap: Awaited<ReturnType<typeof readCoverageMap>>, extension = 'ts') {
  /* See {@link file://./../fixtures/src/math.ts} */
  const fileCoverage = coverageMap.fileCoverageFor(`<process-cwd>/fixtures/src/math.${extension}`)
  const lines = fileCoverage.getLineCoverage()

  // Sum
  expect.soft(lines[2]).toBe(0)

  // Subtract
  expect.soft(lines[6]).toBe(1)

  // Multiply
  expect.soft(lines[10]).toBe(0)

  // Divide
  expect.soft(lines[14]).toBe(0)
}
