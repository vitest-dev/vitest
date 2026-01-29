import type { TestProjectInlineConfiguration } from 'vitest/config'
import Module from 'node:module'
import { defineConfig } from 'vitest/config'

const GENERIC_TESTS = 'test/**.test.ts'
const V8_TESTS = 'test/**.v8.test.ts'
const ISTANBUL_TESTS = 'test/**.istanbul.test.ts'
const CUSTOM_TESTS = 'test/**.custom.test.ts'
const UNIT_TESTS = 'test/**.unit.test.ts'
const BROWSER_TESTS = 'test/**.browser.test.ts'
const FIXTURES = '**/fixtures/**'

export default defineConfig({
  test: {
    reporters: 'verbose',
    isolate: false,
    setupFiles: ['./setup.ts'],
    projects: [
      // Test cases for v8-provider
      {
        extends: true,
        test: {
          name: { label: 'v8', color: 'green' },
          env: { COVERAGE_PROVIDER: 'v8' },
          include: [GENERIC_TESTS, V8_TESTS],
          exclude: [
            ISTANBUL_TESTS,
            UNIT_TESTS,
            CUSTOM_TESTS,
            BROWSER_TESTS,
            FIXTURES,
          ],
        },
      },

      // Test cases for istanbul-provider
      {
        extends: true,
        test: {
          name: { label: 'istanbul', color: 'magenta' },
          env: { COVERAGE_PROVIDER: 'istanbul' },
          include: [GENERIC_TESTS, ISTANBUL_TESTS],
          exclude: [
            V8_TESTS,
            UNIT_TESTS,
            CUSTOM_TESTS,
            BROWSER_TESTS,
            FIXTURES,
          ],
        },
      },

      // Test cases for custom-provider
      {
        extends: true,
        test: {
          name: { label: 'custom', color: 'yellow' },
          env: { COVERAGE_PROVIDER: 'custom' },
          include: [CUSTOM_TESTS],
          exclude: [FIXTURES],
        },
      },

      // Test cases for browser. Browser mode itself is activated by COVERAGE_BROWSER env var.
      {
        extends: true,
        test: {
          name: { label: 'istanbul-browser', color: 'blue' },
          env: { COVERAGE_PROVIDER: 'istanbul', COVERAGE_BROWSER: 'true' },
          testTimeout: 15_000,
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
            '**/query-param-transforms.test.ts',
            '**/test/cjs-dependency.test.ts',
            '**/test/source-maps.test.ts',
            '**/test/mock-autospy.test.ts',
            '**/test/mock-importActual.test.ts',
          ],
          exclude: [FIXTURES],
        },
      },
      {
        extends: true,
        test: {
          name: { label: 'v8-browser', color: 'red' },
          env: { COVERAGE_PROVIDER: 'v8', COVERAGE_BROWSER: 'true' },
          testTimeout: 15_000,
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
            '**/query-param-transforms.test.ts',
            '**/test/cjs-dependency.test.ts',
            '**/test/source-maps.test.ts',
            '**/test/mock-autospy.test.ts',
            '**/test/mock-importActual.test.ts',
          ],
          exclude: [FIXTURES],
        },
      },

      // Test cases for native runner
      // @ts-expect-error Module.registerHooks is only available in Node.js v21+
      ...(Module.registerHooks
        ? [
            {
              extends: true,
              test: {
                name: { label: 'native', color: 'green' },
                env: { COVERAGE_PROVIDER: 'v8', VITE_MODULE_RUNNER: 'false' },
                include: [GENERIC_TESTS, V8_TESTS],
                exclude: [
                  ISTANBUL_TESTS,
                  UNIT_TESTS,
                  CUSTOM_TESTS,
                  BROWSER_TESTS,
                  FIXTURES,

                  // Unsupported features
                  '**/vue.test.ts',
                  '**/workspace.multi-transform.test.ts',
                  '**/web-worker.test.ts',
                  '**/virtual-files.test.ts',
                  '**/query-param-transforms.test.ts',
                  '**/multi-environment.test.ts',
                  '**/import-meta-env.test.ts',
                  '**/decorators.test.ts',
                  '**/import-attributes.test.ts',
                ],
              },
            } satisfies TestProjectInlineConfiguration,
          ]
        : []),

      // Test cases that aren't provider specific
      {
        extends: true,
        test: {
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
    fileParallelism: false,
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
