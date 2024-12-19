import { defineConfig, defineWorkspace } from 'vitest/config'

const GENERIC_TESTS = 'test/**.test.ts'
const V8_TESTS = 'test/**.v8.test.ts'
const ISTANBUL_TESTS = 'test/**.istanbul.test.ts'
const CUSTOM_TESTS = 'test/**.custom.test.ts'
const UNIT_TESTS = 'test/**.unit.test.ts'
const BROWSER_TESTS = 'test/**.browser.test.ts'

const config = defineConfig({
  test: {
    pool: 'threads',
  },
})

export default defineWorkspace([
  // Test cases for v8-provider
  {
    test: {
      ...config.test,
      name: 'v8',
      env: { COVERAGE_PROVIDER: 'v8' },
      include: [GENERIC_TESTS, V8_TESTS],
      exclude: [
        ISTANBUL_TESTS,
        UNIT_TESTS,
        CUSTOM_TESTS,
        BROWSER_TESTS,
      ],
    },
  },

  // Test cases for istanbul-provider
  {
    test: {
      ...config.test,
      name: 'istanbul',
      env: { COVERAGE_PROVIDER: 'istanbul' },
      include: [GENERIC_TESTS, ISTANBUL_TESTS],
      exclude: [
        V8_TESTS,
        UNIT_TESTS,
        CUSTOM_TESTS,
        BROWSER_TESTS,
      ],
    },
  },

  // Test cases for custom-provider
  {
    test: {
      ...config.test,
      name: 'custom',
      env: { COVERAGE_PROVIDER: 'custom' },
      include: [CUSTOM_TESTS],
    },
  },

  // Test cases for browser. Browser mode itself is activated by COVERAGE_BROWSER env var.
  {
    test: {
      ...config.test,
      name: 'istanbul-browser',
      env: { COVERAGE_PROVIDER: 'istanbul', COVERAGE_BROWSER: 'true' },
      include: [
        BROWSER_TESTS,

        // Other non-provider-specific tests that should be run on browser mode as well
        '**/isolation.test.ts',
        '**/include-exclude.test.ts',
        '**/allow-external.test.ts',
        '**/ignore-hints.test.ts',
        '**/import-attributes.test.ts',
        '**/pre-transpiled-source.test.ts',
        '**/multi-suite.test.ts',
        '**/setup-files.test.ts',
        '**/results-snapshot.test.ts',
        '**/reporters.test.ts',
        '**/temporary-files.test.ts',
        '**/test-reporter-conflicts.test.ts',
        '**/vue.test.ts',
      ],
    },
  },
  {
    test: {
      ...config.test,
      name: 'v8-browser',
      env: { COVERAGE_PROVIDER: 'v8', COVERAGE_BROWSER: 'true' },
      include: [
        BROWSER_TESTS,

        // Other non-provider-specific tests that should be run on browser mode as well
        '**/isolation.test.ts',
        '**/include-exclude.test.ts',
        '**/allow-external.test.ts',
        '**/ignore-hints.test.ts',
        '**/import-attributes.test.ts',
        '**/pre-transpiled-source.test.ts',
        '**/multi-suite.test.ts',
        '**/setup-files.test.ts',
        '**/results-snapshot.test.ts',
        '**/reporters.test.ts',
        '**/temporary-files.test.ts',
        '**/test-reporter-conflicts.test.ts',
        '**/vue.test.ts',
      ],
    },
  },

  // Test cases that aren't provider specific
  {
    test: {
      ...config.test,
      name: 'unit',
      include: [UNIT_TESTS],
      typecheck: {
        enabled: true,
        include: ['**/test/*.test-d.ts'],
        tsconfig: '../../tsconfig.check.json',
        ignoreSourceErrors: true,
      },
    },
  },
])
