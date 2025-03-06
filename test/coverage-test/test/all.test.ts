import { expect } from 'vitest'
import { isBrowser, readCoverageMap, runVitest, test } from '../utils'

test('{ all: true } includes uncovered files', async () => {
  await runVitest({
    include: ['fixtures/test/math.test.ts', 'fixtures/test/even.test.ts'],
    coverage: {
      include: ['fixtures/src/**'],
      all: true,
      reporter: 'json',
    },
  })

  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  expect(files).toContain('<process-cwd>/fixtures/src/untested-file.ts')
  expect(files.length).toBeGreaterThanOrEqual(3)

  // Directories starting with dot should be excluded, check for ".should-be-excluded-from-coverage/excluded-from-coverage.ts"
  expect(files.find(file => file.includes('excluded-from-coverage'))).toBeFalsy()
})

test('{ all: false } excludes uncovered files', async () => {
  await runVitest({
    include: ['fixtures/test/math.test.ts', 'fixtures/test/even.test.ts'],
    exclude: ['**/virtual-files-**', '**/custom-1-syntax**'],
    coverage: {
      include: ['fixtures/src/**'],
      all: false,
      reporter: 'json',
    },
  })

  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  // Only executed files should be present on report
  expect(files).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/even.ts",
      "<process-cwd>/fixtures/src/math.ts",
    ]
  `)
})

test('{ all: true } includes uncovered files after watch-mode re-run', async () => {
  const { vitest, ctx } = await runVitest({
    watch: true,
    include: ['fixtures/test/math.test.ts', 'fixtures/test/even.test.ts'],
    coverage: {
      include: ['fixtures/src/**'],
      all: true,
      reporter: 'json',
    },
  })

  {
    const coverageMap = await readCoverageMap()
    const files = coverageMap.files()

    expect(files).toContain('<process-cwd>/fixtures/src/untested-file.ts')
    expect(files.length).toBeGreaterThanOrEqual(3)
  }

  vitest.write('a')

  await vitest.waitForStdout('RERUN')
  await vitest.waitForStdout('rerun all tests')
  await vitest.waitForStdout('Waiting for file changes')
  await ctx!.close()

  {
    const coverageMap = await readCoverageMap()
    const files = coverageMap.files()

    expect(files).toContain('<process-cwd>/fixtures/src/untested-file.ts')
    expect(files.length).toBeGreaterThanOrEqual(3)
  }
})

test('transforms uncovered files correctly', async () => {
  await runVitest({
    config: 'fixtures/configs/vitest.config.conditional.ts',
    include: ['fixtures/test/math.test.ts'],
    coverage: {
      include: ['fixtures/src/math.ts', 'fixtures/src/conditional/*'],
      all: true,
      reporter: 'json',
    },
  })

  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  if (isBrowser()) {
    expect(files).toMatchInlineSnapshot(`
      [
        "<process-cwd>/fixtures/src/math.ts",
        "<process-cwd>/fixtures/src/conditional/browser.ts",
      ]
    `)
  }
  else {
    expect(files).toMatchInlineSnapshot(`
      [
        "<process-cwd>/fixtures/src/math.ts",
        "<process-cwd>/fixtures/src/conditional/node.ts",
      ]
    `)
  }
})
