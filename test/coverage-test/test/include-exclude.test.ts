import assert from 'node:assert'
import { expect } from 'vitest'
import { isBrowser, readCoverageMap, runVitest, test } from '../utils'

test('default include should show only covered files', async () => {
  await runVitest({
    include: ['fixtures/test/math.test.ts', 'fixtures/test/even.test.ts'],
    coverage: {
      reporter: 'json',
    },
  })

  const coverageMap = await readCoverageMap()
  expect(coverageMap.files()).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/even.ts",
      "<process-cwd>/fixtures/src/math.ts",
    ]
  `)
})

test('changed include picks uncovered files', async () => {
  await runVitest({
    include: ['fixtures/test/math.test.ts'],
    coverage: {
      reporter: 'json',
      include: ['fixtures/src/math.ts', 'fixtures/src/untested-file.ts'],
    },
  })

  const coverageMap = await readCoverageMap()
  expect(coverageMap.files()).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/math.ts",
      "<process-cwd>/fixtures/src/untested-file.ts",
    ]
  `)
})

test('include as glob', async () => {
  await runVitest({
    include: ['fixtures/test/math.test.ts', 'fixtures/test/even.test.ts'],
    coverage: {
      reporter: 'json',
      include: ['**/{math,even}.ts'],
    },
  })

  const coverageMap = await readCoverageMap()
  expect(coverageMap.files()).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/even.ts",
      "<process-cwd>/fixtures/src/math.ts",
    ]
  `)
})

test('changed include can exclude covered files', async () => {
  await runVitest({
    include: ['fixtures/test/math.test.ts', 'fixtures/test/even.test.ts'],
    coverage: {
      reporter: 'json',
      include: ['fixtures/src/even.ts'],
    },
  })

  const coverageMap = await readCoverageMap()
  expect(coverageMap.files()).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/even.ts",
    ]
  `)
})

test('exclude can exclude covered files', async () => {
  await runVitest({
    include: ['fixtures/test/math.test.ts', 'fixtures/test/even.test.ts'],
    coverage: {
      reporter: 'json',
      exclude: ['fixtures/src/math.ts'],
    },
  })

  const coverageMap = await readCoverageMap()
  expect(coverageMap.files()).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/even.ts",
    ]
  `)
})

test('exclude can exclude covered files #2', async () => {
  await runVitest({
    include: ['fixtures/test/math.test.ts', 'fixtures/test/even.test.ts'],
    coverage: {
      reporter: 'json',
      include: ['fixtures/src/{math,even}.ts'],

      // pattern that's recognized by picomatch but not by tinyglobby
      exclude: ['math'],
    },
  })

  const coverageMap = await readCoverageMap()
  expect(coverageMap.files()).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/even.ts",
    ]
  `)
})

test('uncovered files are included after watch-mode re-run', async () => {
  const { vitest, ctx } = await runVitest({
    watch: true,
    include: ['fixtures/test/math.test.ts', 'fixtures/test/even.test.ts'],
    coverage: {
      include: ['fixtures/src/**.ts'],
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

test('test, setup and configuration files should never be shown', async () => {
  await runVitest({
    include: ['fixtures/test/math.test.ts'],
    setupFiles: ['fixtures/setup.ts'],
    coverage: {
      reporter: 'json',
      include: [
        'fixtures/src/math.ts',

        // Should not appear on report even when defined
        '**/fixtures/setup.ts',
        '**/math.test.ts',
        '**/vitest.config.ts',
      ],
    },
  })

  const coverageMap = await readCoverageMap()
  expect(coverageMap.files()).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/math.ts",
    ]
  `)
})

test('workspace projects test, setup and configuration files should never be shown', async () => {
  await runVitest({
    coverage: {
      reporter: 'json',
      include: [
        'fixtures/src/math.ts',
        'fixtures/src/even.ts',

        // Should not appear on report even when defined
        '**/fixtures/setup.ts',
        '**/math.test.ts',
        '**/vitest.config.ts',
      ],
    },
    projects: [
      {
        test: {
          name: 'First',
          include: ['fixtures/test/math.test.ts'],
          setupFiles: ['fixtures/setup.ts'],
        },
      },
      {
        test: {
          name: 'Second',
          include: ['fixtures/test/even.test.ts'],
        },
      },
    ],
  })

  const coverageMap = await readCoverageMap()
  expect(coverageMap.files()).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/even.ts",
      "<process-cwd>/fixtures/src/math.ts",
    ]
  `)
})

test('overridden exclude should still apply defaults', async () => {
  await runVitest({
    include: [
      'fixtures/test/math.test.ts',
      'fixtures/src/test-that-looks-like-source-file.ts',
    ],
    coverage: {
      reporter: 'json',
      include: ['fixtures/test/math.test.ts'],
      exclude: ['dont-match-anything'],
    },
  })

  const coverageMap = await readCoverageMap()
  expect(coverageMap.files()).toMatchInlineSnapshot(`{}`)
})

test('uncovered files are transformed correctly', async () => {
  await runVitest({
    config: 'fixtures/configs/vitest.config.conditional.ts',
    include: ['fixtures/test/math.test.ts'],
    coverage: {
      include: ['fixtures/src/math.ts', 'fixtures/src/conditional/*'],
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

test('files included and excluded in plugin\'s configureVitest are excluded', async () => {
  await runVitest({
    config: 'fixtures/configs/vitest.config.configure-vitest-hook.ts',
    include: ['fixtures/test/math.test.ts', 'fixtures/test/even.test.ts'],
    coverage: {
      // Include math.ts by default, exclude it in plugin config
      include: ['**/math.ts'],
      reporter: 'json',
    },
  })

  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  expect(files).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/even.ts",
      "<process-cwd>/fixtures/src/untested-file.ts",
    ]
  `)
})

test('files included and excluded in project\'s plugin\'s configureVitest are excluded', async () => {
  await runVitest({
    coverage: {
      // Include math.ts by default, exclude it in plugin config
      include: ['**/math.ts'],
      reporter: 'json',
    },
    projects: [
      {
        test: {
          name: 'first',
          include: ['fixtures/test/math.test.ts'],
        },
        plugins: [{
          name: 'coverage-options-by-runtime-plugin',
          configureVitest(context) {
            const coverage = context.vitest.config.coverage
            assert(coverage.provider === 'v8' || coverage.provider === 'istanbul')

            coverage.include ||= []
            coverage.include.push('**/even.ts')
          },
        }],
      },
      {
        test: {
          name: 'second',
          include: ['fixtures/test/even.test.ts'],
        },
        plugins: [{
          name: 'coverage-options-by-runtime-plugin',
          configureVitest(context) {
            const coverage = context.vitest.config.coverage
            assert(coverage.provider === 'v8' || coverage.provider === 'istanbul')

            coverage.include ||= []
            coverage.include.push('**/untested-file.ts')
            coverage.exclude.push('**/math.ts')
          },
        }],
      },
    ],
  })

  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  expect(files).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/even.ts",
      "<process-cwd>/fixtures/src/untested-file.ts",
    ]
  `)
})

test('includes covered and uncovered with ] in filenames', async () => {
  await runVitest({
    include: ['fixtures/test/sources-with-]-in-filenames.test.ts'],
    coverage: {
      reporter: 'json',
      include: ['**/untested-with-*', '**/tested-with-*'],

    },
  })

  const coverageMap = await readCoverageMap()
  expect(coverageMap.files()).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/tested-with-]-in-filename.ts",
      "<process-cwd>/fixtures/src/untested-with-]-in-filename.ts",
    ]
  `)
})
