import { runVitest } from '#test-utils'
import { resolve } from 'pathe'
import { describe, expect, test } from 'vitest'
import TestReporter from '../../fixtures/reporters/implementations/custom-reporter'

const reportersDir = resolve(import.meta.dirname, '../../fixtures/reporters/implementations')

describe('custom reporters', () => {
  test('custom reporter instances works', async () => {
    const { stdout } = await runVitest({
      config: false,
      root: './fixtures/reporters/basic',
      reporters: [new TestReporter()],
    })
    expect(stdout).includes('hello from custom reporter')
  })

  test('load no base on root custom reporter instances defined in configuration works', async () => {
    const { stdout, stderr } = await runVitest({
      config: false,
      root: './fixtures/reporters/basic',
      reporters: [
        resolve(reportersDir, './custom-reporter.ts'),
      ],
    })
    expect(stderr).toBe('')
    expect(stdout).includes('hello from custom reporter')
  })

  test('package.json dependencies reporter instances defined in configuration works', async () => {
    const { stdout } = await runVitest({
      config: false,
      root: './fixtures/reporters/basic',
      reporters: ['@test/pkg-reporter', 'vitest-sonar-reporter'],
      outputFile: './sonar-config.xml',
    })
    expect(stdout).includes('hello from package reporter')
  })

  test('a path to a custom reporter defined in configuration works', async () => {
    const { stdout } = await runVitest({
      root: './fixtures/reporters/basic',
      config: false,
      reporters: [
        resolve(reportersDir, './custom-reporter.js'),
      ],
    })
    expect(stdout).includes('hello from custom reporter')
  })

  test('overrides reporters by given a CLI argument --reporter works', async () => {
    const { stdout } = await runVitest({
      root: './fixtures/reporters/basic',
      config: './vitest.config.override.js',
      $cliOptions: {
        // @ts-expect-error reporter is not defined in types
        reporter: resolve(reportersDir, './custom-reporter.js'),
      },
    })
    expect(stdout).not.includes('hello from override')
    expect(stdout).includes('hello from custom reporter')
  })

  test('custom reporter with options', async () => {
    const { stdout } = await runVitest({
      root: './fixtures/reporters/basic',
      config: false,
      reporters: [
        [resolve(reportersDir, './custom-reporter.ts'), { some: { custom: 'option here' } }],
      ],
    })
    expect(stdout).includes('hello from custom reporter')
    expect(stdout).includes('custom reporter options {"some":{"custom":"option here"}}')
  })
})
