import { expect, test } from 'vitest'
import { createCLI } from '../../../packages/vitest/src/node/cac'

const cli = createCLI()

function getArguments(commands: string[]) {
  return cli.parse(['node', '/index.js', ...commands], {
    run: false,
  }).options
}

test('top level nested options return boolean', async () => {
  expect(getArguments(['--coverage', '--browser', '--typecheck'])).toMatchObject({
    coverage: true,
    browser: true,
    typecheck: true,
  })
})

test('negated top level nested options return boolean', async () => {
  expect(getArguments(['--no-coverage', '--no-browser', '--no-typecheck'])).toMatchObject({
    coverage: false,
    browser: false,
    typecheck: false,
  })
})

test('nested coverage options have correct types', async () => {
  expect(getArguments([
    // booleans
    '--coverage.all',
    '--coverage.enabled=',
    'true',
    '--coverage.clean',
    'false',
    '--coverage.cleanOnRerun',
    'true',
    '--coverage.reportOnFailure',
    '--coverage.allowExternal',
    'false',
    '--coverage.skipFull',
    '--coverage.thresholds.autoUpdate',
    'true',
    '--coverage.thresholds.perFile',
    // even if non-boolean is set, it should be true
    '--coverage.thresholds.100',
    '25',

    // text
    '--coverage.provider',
    'v8',
    '--coverage.reporter',
    'text',
    '--coverage.reportsDirectory',
    './coverage',
    '--coverage.customProviderModule',
    './coverage.js',

    // array
    '--coverage.ignoreClassMethods',
    'method1',
    '--coverage.ignoreClassMethods',
    'method2',

    // numbers
    '--coverage.processingConcurrency',
    '2',

    '--coverage.thresholds.statements',
    '80',
    '--coverage.thresholds.lines',
    '100',
    '--coverage.thresholds.functions',
    '30',
    '--coverage.thresholds.branches',
    '25',
  ]).coverage).toEqual({
    enabled: true,
    reporter: 'text',
    all: true,
    provider: 'v8',
    clean: false,
    cleanOnRerun: true,
    reportsDirectory: './coverage',
    customProviderModule: './coverage.js',
    reportOnFailure: true,
    allowExternal: false,
    skipFull: true,
    ignoreClassMethods: ['method1', 'method2'],
    processingConcurrency: 2,
    thresholds: {
      statements: 80,
      lines: 100,
      functions: 30,
      branches: 25,
      perFile: true,
      autoUpdate: true,
      100: true,
    },
  })
})
