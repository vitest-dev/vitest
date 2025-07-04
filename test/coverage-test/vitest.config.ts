import { defineConfig } from 'vitest/config'

const GENERIC_TESTS = 'test/**.test.ts'
const V8_TESTS = 'test/**.v8.test.ts'
const ISTANBUL_TESTS = 'test/**.istanbul.test.ts'
const CUSTOM_TESTS = 'test/**.custom.test.ts'
const UNIT_TESTS = 'test/**.unit.test.ts'
const BROWSER_TESTS = 'test/**.browser.test.ts'

const config = defineConfig({
  test: {
    pool: 'threads',
    setupFiles: ['./setup.ts'],
  },
})

export default defineConfig({
  test: {
    reporters: 'verbose',
    isolate: false,
    projects: [
      // Test cases for v8-provider
      {
        test: {
          ...config.test,
          name: { label: 'v8', color: 'green' },
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
          name: { label: 'istanbul', color: 'magenta' },
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
          name: { label: 'custom', color: 'yellow' },
          env: { COVERAGE_PROVIDER: 'custom' },
          include: [CUSTOM_TESTS],
        },
      },

      // Test cases for browser. Browser mode itself is activated by COVERAGE_BROWSER env var.
      {
        test: {
          ...config.test,
          name: { label: 'istanbul-browser', color: 'blue' },
          env: { COVERAGE_PROVIDER: 'istanbul', COVERAGE_BROWSER: 'true' },
          include: [
            BROWSER_TESTS,

            // Other non-provider-specific tests that should be run on browser mode as well
            '**/all.test.ts',
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
            '**/in-source.test.ts',
          ],
        },
      },
      {
        test: {
          ...config.test,
          name: { label: 'v8-browser', color: 'red' },
          env: { COVERAGE_PROVIDER: 'v8', COVERAGE_BROWSER: 'true' },
          include: [
            BROWSER_TESTS,

            // Other non-provider-specific tests that should be run on browser mode as well
            '**/all.test.ts',
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
            '**/in-source.test.ts',
          ],
        },
      },

      // Test cases that aren't provider specific
      {
        test: {
          ...config.test,
          name: { label: 'unit', color: 'cyan' },
          include: [UNIT_TESTS],
          typecheck: {
            enabled: true,
            include: ['**/test/*.test-d.ts'],
            tsconfig: '../../tsconfig.check.json',
            ignoreSourceErrors: true,
          },
        },
      },
    ],
    poolOptions: {
      threads: {
        // Tests may have side effects, e.g. writing files to disk,
        singleThread: true,
      },
    },
    onConsoleLog(log) {
      if (log.includes('ERROR: Coverage for')) {
        // Ignore threshold error messages
        return false
      }

      if (log.includes('Updating thresholds to configuration file.')) {
        // Ignore threshold updating messages
        return false
      }
    },
  },
})
