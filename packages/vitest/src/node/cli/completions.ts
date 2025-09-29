import type { CAC } from 'cac'
import tab from '@bomb.sh/tab/cac'

// Sets up tab completions for the Vitest CLI using the @bomb.sh/tab library
export async function setupTabCompletions(cli: CAC): Promise<void> {
  await tab(cli, {
      subCommands: {
        run: {
          args: {
            filters: function (complete) {
              complete('**/*.test.ts', 'TypeScript test files')
              complete('**/*.test.js', 'JavaScript test files')
              complete('**/*.spec.ts', 'TypeScript spec files')
              complete('**/*.spec.js', 'JavaScript spec files')
            },
          },
        },
        watch: {
          args: {
            filters: function (complete) {
              complete('**/*.test.ts', 'TypeScript test files')
              complete('**/*.test.js', 'JavaScript test files')
              complete('**/*.spec.ts', 'TypeScript spec files')
              complete('**/*.spec.js', 'JavaScript spec files')
            },
          },
        },
        dev: {
          args: {
            filters: function (complete) {
              complete('**/*.test.ts', 'TypeScript test files')
              complete('**/*.test.js', 'JavaScript test files')
              complete('**/*.spec.ts', 'TypeScript spec files')
              complete('**/*.spec.js', 'JavaScript spec files')
            },
          },
        },
        related: {
          args: {
            filters: function (complete) {
              complete('src/**/*.ts', 'TypeScript source files')
              complete('src/**/*.js', 'JavaScript source files')
              complete('lib/**/*.ts', 'TypeScript library files')
              complete('lib/**/*.js', 'JavaScript library files')
            },
          },
        },
        bench: {
          args: {
            filters: function (complete) {
              complete('**/*.bench.ts', 'TypeScript benchmark files')
              complete('**/*.bench.js', 'JavaScript benchmark files')
              complete('**/*.benchmark.ts', 'TypeScript benchmark files')
              complete('**/*.benchmark.js', 'JavaScript benchmark files')
            },
          },
        },
        init: {
          args: {
            project: function (complete) {
              complete('browser', 'Initialize browser testing setup')
            },
          },
        },
        list: {
          args: {
            filters: function (complete) {
              complete('**/*.test.ts', 'TypeScript test files')
              complete('**/*.test.js', 'JavaScript test files')
              complete('**/*.spec.ts', 'TypeScript spec files')
              complete('**/*.spec.js', 'JavaScript spec files')
            },
          },
        },
      },
      options: {
        config: function (complete) {
          complete('vitest.config.ts', 'TypeScript config file')
          complete('vitest.config.js', 'JavaScript config file')
          complete('vitest.config.mjs', 'ES module config file')
          complete('vite.config.ts', 'Vite TypeScript config file')
          complete('vite.config.js', 'Vite JavaScript config file')
        },
        root: function (complete) {
          complete('./', 'Current directory')
          complete('../', 'Parent directory')
          complete('src/', 'Source directory')
        },
        mode: function (complete) {
          complete('test', 'Test mode')
          complete('benchmark', 'Benchmark mode')
          complete('development', 'Development mode')
          complete('production', 'Production mode')
        },
        environment: function (complete) {
          complete('node', 'Node.js environment')
          complete('jsdom', 'JSDOM environment')
          complete('happy-dom', 'Happy DOM environment')
          complete('edge-runtime', 'Edge runtime environment')
        },
        pool: function (complete) {
          complete('threads', 'Threads pool')
          complete('forks', 'Forks pool')
          complete('vmThreads', 'VM threads pool')
          complete('vmForks', 'VM forks pool')
        },
        reporter: function (complete) {
          complete('default', 'Default reporter')
          complete('verbose', 'Verbose reporter')
          complete('dot', 'Dot reporter')
          complete('json', 'JSON reporter')
          complete('junit', 'JUnit reporter')
          complete('html', 'HTML reporter')
          complete('tap', 'TAP reporter')
          complete('tap-flat', 'TAP flat reporter')
          complete('hanging-process', 'Hanging process reporter')
        },
        'coverage.provider': function (complete) {
          complete('v8', 'V8 coverage provider')
          complete('istanbul', 'Istanbul coverage provider')
          complete('custom', 'Custom coverage provider')
        },
        'coverage.reporter': function (complete) {
          complete('text', 'Text coverage reporter')
          complete('html', 'HTML coverage reporter')
          complete('clover', 'Clover coverage reporter')
          complete('json', 'JSON coverage reporter')
          complete('json-summary', 'JSON summary coverage reporter')
          complete('lcov', 'LCOV coverage reporter')
          complete('lcovonly', 'LCOV only coverage reporter')
          complete('teamcity', 'TeamCity coverage reporter')
          complete('cobertura', 'Cobertura coverage reporter')
        },
        'browser.name': function (complete) {
          complete('chrome', 'Google Chrome')
          complete('firefox', 'Mozilla Firefox')
          complete('safari', 'Safari')
          complete('edge', 'Microsoft Edge')
          complete('chromium', 'Chromium')
        },
        'browser.provider': function (complete) {
          complete('playwright', 'Playwright provider')
          complete('webdriverio', 'WebdriverIO provider')
          complete('preview', 'Preview provider')
        },
        testNamePattern: function (complete) {
          complete('should.*work', 'Tests containing "should" and "work"')
          complete('integration.*test', 'Integration tests')
          complete('unit.*test', 'Unit tests')
        },
        silent: function (complete) {
          complete('true', 'Enable silent mode')
          complete('false', 'Disable silent mode')
          complete('passed-only', 'Show logs from failing tests only')
        },
      },
    })
}
