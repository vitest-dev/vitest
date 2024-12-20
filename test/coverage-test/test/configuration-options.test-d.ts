import type { CoverageProviderModule, ResolvedCoverageOptions, Vitest } from 'vitest'
import type { defineConfig } from 'vitest/config'
import { assertType, test } from 'vitest'

type NarrowToTestConfig<T> = T extends { test?: any } ? NonNullable<T['test']> : never
type Configuration = NarrowToTestConfig<(Parameters<typeof defineConfig>[0])>
type Coverage = NonNullable<Configuration['coverage']>

test('providers, built-in', () => {
  assertType<Coverage>({ provider: 'v8' })
  assertType<Coverage>({ provider: 'istanbul' })

  // @ts-expect-error -- String options must be known ones only
  assertType<Coverage>({ provider: 'unknown-provider' })
})

test('providers, custom', () => {
  assertType<Coverage>({
    provider: 'custom',
    customProviderModule: 'custom-provider-module.ts',
  })
})

test('provider options, generic', () => {
  assertType<Coverage>({
    provider: 'v8',
    enabled: true,
    include: ['string'],
    watermarks: {
      functions: [80, 95],
      lines: [80, 95],
    },
    thresholds: {
      '100': true,
      'lines': 1,
      'autoUpdate': true,
      'perFile': true,
      'statements': 100,

      '**/some-file.ts': {
        100: true,
        lines: 12,
        branches: 12,
        functions: 12,
        statements: 12,
      },
    },
  })

  assertType<Coverage>({
    provider: 'istanbul',
    enabled: true,
    include: ['string'],
    watermarks: {
      statements: [80, 95],
    },
    thresholds: {
      '100': false,
      'lines': 1,
      'autoUpdate': true,
      'perFile': true,
      'statements': 100,

      '**/some-file.ts': {
        100: false,
        lines: 12,
        branches: 12,
        functions: 12,
        statements: 12,
      },
    },
  })
})

test('provider specific options, v8', () => {
  assertType<Coverage>({
    provider: 'v8',
    // @ts-expect-error -- Istanbul-only option is not allowed
    ignoreClassMethods: ['string'],
  })
})

test('provider specific options, istanbul', () => {
  assertType<Coverage>({
    provider: 'istanbul',
    ignoreClassMethods: ['string'],
  })
})

test('provider specific options, custom', () => {
  assertType<Coverage>({
    provider: 'custom',
    customProviderModule: 'custom-provider-module.ts',
    enabled: true,
  })

  // @ts-expect-error --  customProviderModule is required
  assertType<Coverage>({ provider: 'custom' })

  assertType<Coverage>({
    provider: 'custom',
    customProviderModule: 'some-module',

    // @ts-expect-error --  typings of BaseCoverageOptions still apply
    enabled: 'not boolean',
  })
})

test('provider module', () => {
  assertType<CoverageProviderModule>({
    getProvider() {
      return {
        name: 'custom-provider',
        initialize(_: Vitest) {},
        generateCoverage() {},
        resolveOptions(): ResolvedCoverageOptions {
          return {
            clean: true,
            cleanOnRerun: true,
            enabled: true,
            exclude: ['string'],
            extension: ['string'],
            reporter: [['html', {}], ['json', { file: 'string' }]],
            reportsDirectory: 'string',
            reportOnFailure: true,
            allowExternal: true,
            processingConcurrency: 1,
          }
        },
        clean(_?: boolean) {},
        onBeforeFilesRun() {},
        onAfterSuiteRun({ coverage: _coverage }) {},
        reportCoverage() {},
        onFileTransform(_code: string, _id: string, ctx) {
          ctx.getCombinedSourcemap()
        },
      }
    },
    takeCoverage() {},
    startCoverage() {},
    stopCoverage() {},
  })
})

test('reporters, single', () => {
  assertType<Coverage>({ reporter: 'clover' })
  assertType<Coverage>({ reporter: 'cobertura' })
  assertType<Coverage>({ reporter: 'html-spa' })
  assertType<Coverage>({ reporter: 'html' })
  assertType<Coverage>({ reporter: 'json-summary' })
  assertType<Coverage>({ reporter: 'json' })
  assertType<Coverage>({ reporter: 'lcov' })
  assertType<Coverage>({ reporter: 'lcovonly' })
  assertType<Coverage>({ reporter: 'none' })
  assertType<Coverage>({ reporter: 'teamcity' })
  assertType<Coverage>({ reporter: 'text-lcov' })
  assertType<Coverage>({ reporter: 'text-summary' })
  assertType<Coverage>({ reporter: 'text' })
  assertType<Coverage>({ reporter: 'custom-reporter' })
})

test('reporters, multiple', () => {
  assertType<Coverage>({
    reporter: [
      'clover',
      'cobertura',
      'html-spa',
      'html',
      'json-summary',
      'json',
      'lcov',
      'lcovonly',
      'none',
      'teamcity',
      'text-lcov',
      'text-summary',
      'text',
    ],
  })

  assertType<Coverage>({ reporter: ['custom-reporter'] })
  assertType<Coverage>({ reporter: ['html', 'json', 'custom-reporter'] })
})

test('reporters, with options', () => {
  assertType<Coverage>({
    reporter: [
      ['clover', { projectRoot: 'string', file: 'string' }],
      ['cobertura', { projectRoot: 'string', file: 'string' }],
      ['html-spa', { metricsToShow: ['branches', 'functions'], verbose: true, subdir: 'string' }],
      ['html', { verbose: true, subdir: 'string' }],
      ['json-summary', { file: 'string' }],
      ['json', { file: 'string' }],
      ['lcov', { projectRoot: 'string', file: 'string' }],
      ['lcovonly', { projectRoot: 'string', file: 'string' }],
      ['none'],
      ['teamcity', { blockName: 'string' }],
      ['text-lcov', { projectRoot: 'string' }],
      ['text-summary', { file: 'string' }],
      ['text', { skipEmpty: true, skipFull: true, maxCols: 1 }],
      ['custom-reporter', { 'someOption': true, 'some-other-custom-option': { width: 123 } }],
    ],
  })

  assertType<Coverage>({
    reporter: [
      ['html', { subdir: 'string' }],
      ['json'],
      ['lcov', { projectRoot: 'string' }],
    ],
  })

  assertType<Coverage>({
    reporter: [
      // @ts-expect-error -- second value should be object even though TS intellisense prompts types of reporters
      ['lcov', 'html-spa'],
    ],
  })
})

test('reporters, mixed variations', () => {
  assertType<Coverage>({
    reporter: [
      'clover',
      'custom-reporter-1',
      ['cobertura'],
      ['custom-reporter-2'],
      ['html-spa', {}],
      ['custom-reporter-3', {}],
      ['html', { verbose: true, subdir: 'string' }],
      ['custom-reporter-4', { some: 'option', width: 123 }],
    ],
  })
})
