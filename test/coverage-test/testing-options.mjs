import { startVitest } from 'vitest/node'

/** @type {Record<string, Partial<import('vitest/config').UserConfig['test']>>[]} */
const testCases = [
  {
    testConfig: {
      name: 'allowExternal: true',
      include: ['option-tests/allow-external.test.ts'],
      coverage: {
        allowExternal: true,
        include: ['**/src/**', '**/test-utils/fixtures/**'],
        reporter: 'html',
      },
    },
    assertionConfig: {
      include: ['coverage-report-tests/allow-external.test.ts'],
      env: { VITE_COVERAGE_ALLOW_EXTERNAL: true },
    },
  },
  {
    testConfig: {
      name: 'allowExternal: false',
      include: ['option-tests/allow-external.test.ts'],
      coverage: {
        allowExternal: false,
        include: ['**/src/**', '**/test-utils/fixtures/**'],
        reporter: 'html',
      },
    },
    assertionConfig: {
      include: ['coverage-report-tests/allow-external.test.ts'],
    },
  },
  {
    testConfig: {
      name: 'thresholds.100',
      include: ['option-tests/threshold-100.test.ts'],
      coverage: {
        thresholds: {
          100: true,
        },
      },
    },
    assertionConfig: null,
  },
]

for (const provider of ['v8', 'istanbul']) {
  for (const { testConfig, assertionConfig } of testCases) {
    // Run test case
    await startVitest('test', ['option-tests/'], {
      config: false,
      watch: false,
      ...testConfig,
      name: `${provider} - ${testConfig.name}`,
      coverage: {
        enabled: true,
        clean: true,
        all: false,
        provider,
        ...testConfig.coverage,
      },
    })

    checkExit()

    if (!assertionConfig)
      continue

    // Check generated coverage report
    await startVitest('test', ['coverage-report-tests'], {
      config: false,
      watch: false,
      ...assertionConfig,
      name: `${provider} - assert ${testConfig.name}`,
    })

    checkExit()
  }
}

function checkExit() {
  if (process.exitCode)
    process.exit(process.exitCode)
}
