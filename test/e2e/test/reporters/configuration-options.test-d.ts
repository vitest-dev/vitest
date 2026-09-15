import type { defineConfig } from 'vitest/config'
import type { BuiltinReporterOptions } from 'vitest/node'
import { assertType, expectTypeOf, test } from 'vitest'

type NarrowToTestConfig<T> = T extends { test?: any } ? NonNullable<T['test']> : never
type Configuration = NonNullable<NarrowToTestConfig<(Parameters<typeof defineConfig>[0])>>

test('reporters, single', () => {
  assertType<Configuration>({ reporters: 'default' })
  assertType<Configuration>({ reporters: 'dot' })
  assertType<Configuration>({ reporters: 'hanging-process' })
  assertType<Configuration>({ reporters: 'html' })
  assertType<Configuration>({ reporters: 'json' })
  assertType<Configuration>({ reporters: 'junit' })
  assertType<Configuration>({ reporters: 'tap' })
  assertType<Configuration>({ reporters: 'tap-flat' })
  assertType<Configuration>({ reporters: 'verbose' })

  assertType<Configuration>({ reporters: 'custom-reporter' })
  assertType<Configuration>({ reporters: './reporter.mjs' })
  assertType<Configuration>({ reporters: { onTestRunEnd() {} } })
})

test('reporters, multiple', () => {
  assertType<Configuration>({
    reporters: [
      'default',
      'dot',
      'hanging-process',
      'html',
      'json',
      'junit',
      'tap',
      'tap-flat',
      'verbose',
    ],
  })
  assertType<Configuration>({ reporters: ['custom-reporter'] })
  assertType<Configuration>({ reporters: ['html', 'json', 'custom-reporter'] })
})

test('reporters, with options', () => {
  assertType<Configuration>({
    reporters: [
      ['github-actions', { jobSummary: { title: 'Custom Test Report' } }],
      ['json', { outputFile: 'test.json' }],
      ['junit', { classname: 'something', suiteName: 'Suite name', outputFile: 'test.json' }],
      ['vitest-sonar-reporter', { outputFile: 'report.xml' }],
    ],
  })
})

test('reporters, mixed variations', () => {
  assertType<Configuration>({
    reporters: [
      'default',
      ['verbose'],
      ['json', { outputFile: 'test.json' }],
    ],
  })
})

test('minimal reporter silent options', () => {
  expectTypeOf<BuiltinReporterOptions['minimal']['silent']>().toEqualTypeOf<boolean | 'passed-only' | undefined>()
  expectTypeOf<BuiltinReporterOptions['agent']['silent']>().toEqualTypeOf<boolean | 'passed-only' | undefined>()

  assertType<Configuration>({
    reporters: [
      ['minimal', { silent: true }],
      ['minimal', { silent: false }],
      ['minimal', { silent: 'passed-only' }],
      ['agent', { silent: true }],
      ['agent', { silent: false }],
      ['agent', { silent: 'passed-only' }],
    ],
  })
})
