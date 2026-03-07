import { runVitest, StableTestFileOrderSorter } from '#test-utils'
import { describe, expect, test } from 'vitest'
import { trimReporterOutput } from './utils'

describe('agent reporter', async () => {
  test('hides passed module headers, shows only failed tests, and prints end summary', async () => {
    const { stdout } = await runVitest({
      include: ['b1.test.ts', 'b2.test.ts'],
      root: 'fixtures/reporters/default',
      reporters: [['agent', {}]],
      fileParallelism: false,
      sequence: {
        sequencer: StableTestFileOrderSorter,
      },
    })

    const output = trimReporterOutput(stdout)
    expect(output).toMatchInlineSnapshot(`
      "❯ b1.test.ts (13 tests | 1 failed) [...]ms
           × b failed test [...]ms
       ❯ b2.test.ts (13 tests | 1 failed) [...]ms
           × b failed test [...]ms"
    `)

    const summary = stdout.replace(/\d+ms/g, '[...]ms').split('\n').filter(line => /Test Files|^\s*Tests\b/.test(line)).map(line => line.trim()).join('\n')
    expect(summary).toMatchInlineSnapshot(`
      "Test Files  2 failed (2)
      Tests  2 failed | 24 passed (26)"
    `)
  })

  test('hides all output for passed-only modules', async () => {
    const { stdout } = await runVitest({
      include: ['b1.test.ts', 'b2.test.ts'],
      root: 'fixtures/reporters/default',
      reporters: [['agent', {}]],
      fileParallelism: false,
      testNamePattern: 'passed',
      sequence: {
        sequencer: StableTestFileOrderSorter,
      },
    })

    const output = trimReporterOutput(stdout)
    expect(output).toMatchInlineSnapshot(`""`)
  })

  test('shows console logs only from failed file, suite, and tests', async () => {
    const { stdout } = await runVitest({
      config: false,
      include: ['./fixtures/reporters/console-some-failing.test.ts'],
      reporters: [['agent', { isTTY: true }]],
    })

    const logs = stdout.split('\n').filter(line => line.includes('Log from')).join('\n')
    expect(logs).toMatchInlineSnapshot(`
      "Log from failed test
      Log from failed test
      Log from failed suite
      Log from failed file"
    `)
  })
}, 120000)
