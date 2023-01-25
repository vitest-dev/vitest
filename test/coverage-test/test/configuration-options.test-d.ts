import { assertType, test } from 'vitest'
import type { ResolvedCoverageOptions, Vitest } from 'vitest'
import type { defineConfig } from 'vitest/config'

type NarrowToTestConfig<T> = T extends { test?: any } ? NonNullable<T['test']> : never
type Configuration = NarrowToTestConfig<(Parameters<typeof defineConfig>[0])>
type Coverage = NonNullable<Configuration['coverage']>

test('providers, built-in', () => {
  assertType<Coverage>({ provider: 'c8' })
  assertType<Coverage>({ provider: 'istanbul' })

  // @ts-expect-error -- String options must be known built-in's
  assertType<Coverage>({ provider: 'unknown-reporter' })
})

test('providers, custom', () => {
  assertType<Coverage>({
    provider: {
      getProvider() {
        return {
          name: 'custom-provider',
          initialize(_: Vitest) {},
          resolveOptions(): ResolvedCoverageOptions {
            return {
              clean: true,
              cleanOnRerun: true,
              enabled: true,
              exclude: ['string'],
              extension: ['string'],
              reporter: ['html', 'json'],
              reportsDirectory: 'string',
            }
          },
          clean(_: boolean) {},
          onBeforeFilesRun() {},
          onAfterSuiteRun({ coverage: _coverage }) {},
          reportCoverage() {},
          onFileTransform(_code: string, _id: string, ctx) {
            ctx.getCombinedSourcemap()
          },
        }
      },
      takeCoverage() {},
    },
  })
})

test('provider options, generic', () => {
  assertType<Coverage>({
    provider: 'c8',
    enabled: true,
    include: ['string'],
  })

  assertType<Coverage>({
    provider: 'istanbul',
    enabled: true,
    include: ['string'],
  })
})

test('provider specific options, c8', () => {
  assertType<Coverage>({
    provider: 'c8',
    src: ['string'],
    100: true,
    excludeNodeModules: false,
    allowExternal: true,
  })

  assertType<Coverage>({
    provider: 'c8',
    // @ts-expect-error -- Istanbul-only option is not allowed
    ignoreClassMethods: ['string'],
  })
})

test('provider specific options, istanbul', () => {
  assertType<Coverage>({
    provider: 'istanbul',
    ignoreClassMethods: ['string'],
    watermarks: {
      statements: [80, 95],
      functions: [80, 95],
      branches: [80, 95],
      lines: [80, 95],
    },
  })

  assertType<Coverage>({
    provider: 'istanbul',
    // @ts-expect-error -- C8-only option is not allowed
    src: ['string'],
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

  // @ts-expect-error -- String reporters must be known built-in's
  assertType<Coverage>({ reporter: 'unknown-reporter' })
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

  // @ts-expect-error -- List of string reporters must be known built-in's
  assertType<Coverage>({ reporter: ['unknown-reporter'] })

  // @ts-expect-error -- ... and all reporters must be known
  assertType<Coverage>({ reporter: ['html', 'json', 'unknown-reporter'] })
})
