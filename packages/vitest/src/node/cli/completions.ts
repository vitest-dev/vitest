import type { CAC } from 'cac'
import tab from '@bomb.sh/tab/cac'

function testFilters(complete: (pattern: string, desc: string) => void) {
  complete('**/*.test.ts', 'TypeScript test files')
  complete('**/*.test.js', 'JavaScript test files')
  complete('**/*.spec.ts', 'TypeScript spec files')
  complete('**/*.spec.js', 'JavaScript spec files')
}

function benchFilters(complete: (pattern: string, desc: string) => void) {
  complete('**/*.bench.ts', 'TypeScript benchmark files')
  complete('**/*.bench.js', 'JavaScript benchmark files')
  complete('**/*.benchmark.ts', 'TypeScript benchmark files')
  complete('**/*.benchmark.js', 'JavaScript benchmark files')
}

function relatedFilters(complete: (pattern: string, desc: string) => void) {
  complete('src/**/*.ts', 'TypeScript source files')
  complete('src/**/*.js', 'JavaScript source files')
  complete('lib/**/*.ts', 'TypeScript library files')
  complete('lib/**/*.js', 'JavaScript library files')
}

export async function setupTabCompletions(cli: CAC): Promise<void> {
  await tab(cli, {
    subCommands: {
      run:   { args: { filters: testFilters } },
      watch: { args: { filters: testFilters } },
      dev:   { args: { filters: testFilters } },
      list:  { args: { filters: testFilters } },
      related: { args: { filters: relatedFilters } },
      bench: { args: { filters: benchFilters } },
      init: {
        args: {
          project(complete) {
            complete('browser', 'Initialize browser testing setup')
          },
        },
      },
    },
    options: {
      config(complete) {
        complete('vitest.config.ts', 'TypeScript config file')
        complete('vitest.config.js', 'JavaScript config file')
        complete('vitest.config.mjs', 'ES module config file')
        complete('vite.config.ts', 'Vite TypeScript config file')
        complete('vite.config.js', 'Vite JavaScript config file')
      },
      mode(complete) {
        complete('test', 'Test mode')
        complete('benchmark', 'Benchmark mode')
        complete('development', 'Development mode')
        complete('production', 'Production mode')
      },
      environment(complete) {
        complete('node', 'Node.js environment')
        complete('jsdom', 'JSDOM environment')
        complete('happy-dom', 'Happy DOM environment')
        complete('edge-runtime', 'Edge runtime environment')
      },
      pool(complete) {
        complete('threads', 'Threads pool')
        complete('forks', 'Forks pool')
        complete('vmThreads', 'VM threads pool')
        complete('vmForks', 'VM forks pool')
      },
      reporter(complete) {
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
      'coverage.provider'(complete) {
        complete('v8', 'V8 coverage provider')
        complete('istanbul', 'Istanbul coverage provider')
        complete('custom', 'Custom coverage provider')
      },
      'coverage.reporter'(complete) {
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
      'browser.name'(complete) {
        complete('chrome', 'Google Chrome')
        complete('firefox', 'Mozilla Firefox')
        complete('safari', 'Safari')
        complete('edge', 'Microsoft Edge')
        complete('chromium', 'Chromium')
      },
      'browser.provider'(complete) {
        complete('playwright', 'Playwright provider')
        complete('webdriverio', 'WebdriverIO provider')
        complete('preview', 'Preview provider')
      },
      testNamePattern(complete) {
        complete('should.*work', 'Tests containing "should" and "work"')
        complete('integration.*test', 'Integration tests')
        complete('unit.*test', 'Unit tests')
      },
      silent(complete) {
        complete('true', 'Enable silent mode')
        complete('false', 'Disable silent mode')
        complete('passed-only', 'Show logs from failing tests only')
      },
    },
  })
}
