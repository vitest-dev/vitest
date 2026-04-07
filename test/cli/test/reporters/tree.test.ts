import { runVitest, StableTestFileOrderSorter } from '#test-utils'
import { describe, expect, it } from 'vitest'
import { trimReporterOutput } from './utils'

describe('tree reporter', () => {
  it('reports a single test as a tree', async () => {
    const { stdout } = await runVitest({
      include: ['a.test.ts'],
      root: 'fixtures/reporters/default',
      reporters: ['tree'],
    })

    expect(trimReporterOutput(stdout)).toMatchInlineSnapshot(`
      "❯ a.test.ts (16 tests | 1 failed | 3 skipped) [...]ms
         ✓ a passed (6)
           ✓ a1 test [...]ms
           ✓ a2 test [...]ms
           ✓ a3 test [...]ms
           ✓ nested a (3)
             ✓ nested a1 test [...]ms
             ✓ nested a2 test [...]ms
             ✓ nested a3 test [...]ms
         ❯ a failed (7)
           ✓ a failed 1 test [...]ms
           ✓ a failed 2 test [...]ms
           ✓ a failed 3 test [...]ms
           × a failed test [...]ms
           ✓ nested a failed (3)
             ✓ nested a failed 1 test [...]ms
             ✓ nested a failed 2 test [...]ms
             ✓ nested a failed 3 test [...]ms
         ✓ a skipped (3)
           ↓ skipped with note [...]ms [reason]
           ↓ condition [...]ms
           ↓ condition with note [...]ms [note]"
    `)
  })

  it('reports multiple tests when all passed with testname filter as a tree', async () => {
    const { stdout } = await runVitest({
      include: ['b1.test.ts', 'b2.test.ts'],
      root: 'fixtures/reporters/default',
      reporters: ['tree'],
      fileParallelism: false,
      testNamePattern: 'passed',
      sequence: {
        sequencer: StableTestFileOrderSorter,
      },
    })

    expect(trimReporterOutput(stdout)).toMatchInlineSnapshot(`
      "✓ b1.test.ts (13 tests | 7 skipped) [...]ms
         ✓ b1 passed (6)
           ✓ b1 test [...]ms
           ✓ b2 test [...]ms
           ✓ b3 test [...]ms
           ✓ nested b (3)
             ✓ nested b1 test [...]ms
             ✓ nested b2 test [...]ms
             ✓ nested b3 test [...]ms
         ↓ b1 failed (7)
           ↓ b1 test
           ↓ b2 test
           ↓ b3 test
           ↓ b failed test
           ↓ nested b (3)
             ↓ nested b1 test
             ↓ nested b2 test
             ↓ nested b3 test
       ✓ b2.test.ts (13 tests | 7 skipped) [...]ms
         ✓ b2 passed (6)
           ✓ b1 test [...]ms
           ✓ b2 test [...]ms
           ✓ b3 test [...]ms
           ✓ nested b (3)
             ✓ nested b1 test [...]ms
             ✓ nested b2 test [...]ms
             ✓ nested b3 test [...]ms
         ↓ b2 failed (7)
           ↓ b1 test
           ↓ b2 test
           ↓ b3 test
           ↓ b failed test
           ↓ nested b (3)
             ↓ nested b1 test
             ↓ nested b2 test
             ↓ nested b3 test"
    `)
  })

  it('reports multiple tests when some fail as a tree', async () => {
    const { stdout } = await runVitest({
      include: ['b1.test.ts', 'b2.test.ts'],
      root: 'fixtures/reporters/default',
      reporters: ['tree'],
      fileParallelism: false,
      sequence: {
        sequencer: StableTestFileOrderSorter,
      },
    })

    expect(trimReporterOutput(stdout)).toMatchInlineSnapshot(`
      "❯ b1.test.ts (13 tests | 1 failed) [...]ms
         ✓ b1 passed (6)
           ✓ b1 test [...]ms
           ✓ b2 test [...]ms
           ✓ b3 test [...]ms
           ✓ nested b (3)
             ✓ nested b1 test [...]ms
             ✓ nested b2 test [...]ms
             ✓ nested b3 test [...]ms
         ❯ b1 failed (7)
           ✓ b1 test [...]ms
           ✓ b2 test [...]ms
           ✓ b3 test [...]ms
           × b failed test [...]ms
           ✓ nested b (3)
             ✓ nested b1 test [...]ms
             ✓ nested b2 test [...]ms
             ✓ nested b3 test [...]ms
       ❯ b2.test.ts (13 tests | 1 failed) [...]ms
         ✓ b2 passed (6)
           ✓ b1 test [...]ms
           ✓ b2 test [...]ms
           ✓ b3 test [...]ms
           ✓ nested b (3)
             ✓ nested b1 test [...]ms
             ✓ nested b2 test [...]ms
             ✓ nested b3 test [...]ms
         ❯ b2 failed (7)
           ✓ b1 test [...]ms
           ✓ b2 test [...]ms
           ✓ b3 test [...]ms
           × b failed test [...]ms
           ✓ nested b (3)
             ✓ nested b1 test [...]ms
             ✓ nested b2 test [...]ms
             ✓ nested b3 test [...]ms"
    `)
  })
})
