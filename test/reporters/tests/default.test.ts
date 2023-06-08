import { resolve } from 'pathe'
import { describe, expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

const root = resolve(__dirname, '../fixtures')
const run = async (fileFilter: string[]) => await runVitest({ root, reporters: 'default' }, fileFilter)

describe('default reporter', async () => {
  process.stdin.isTTY = true
  process.stdout.isTTY = true

  test('normal', async () => {
    const { stdout } = await run(['b1.test.ts', 'b2.test.ts'])
    expect(stdout).toMatchInlineSnapshot(`
      "
       RUN  v0.32.0 /root/p/vitest/test/reporters/fixtures

       · default/b1.test.ts (13)
       ❯ default/b2.test.ts (13)
         ✓ b2 passed (6)
         ❯ b2 failed (7)
           ✓ b1 test
           ✓ b2 test
           ✓ b3 test
           × b failed test
           ✓ nested b (3)
       ❯ default/b1.test.ts (13)
         ✓ b1 passed (6)
         ❯ b1 failed (7)
           ✓ b1 test
           ✓ b2 test
           ✓ b3 test
           × b failed test
           ✓ nested b (3)
       ❯ default/b2.test.ts (13)
         ✓ b2 passed (6)
         ❯ b2 failed (7)
           ✓ b1 test
           ✓ b2 test
           ✓ b3 test
           × b failed test
           ✓ nested b (3)

       Test Files  2 failed (2)
            Tests  2 failed | 24 passed (26)
         Start at  02:54:26
         Duration  866ms (transform 33ms, setup 0ms, collect 54ms, tests 34ms, environment 0ms, prepare 174ms)

      "
    `)
    expect(stdout).contain('✓ b2 test')
    expect(stdout).not.contain('✓ nested b1 test')
    expect(stdout).contain('× b failed test')
  }, 120000)

  test('show full test suite when only one file', async () => {
    const { stdout } = await run(['a.test.ts'])
    expect(stdout).contain('✓ a1 test')
    expect(stdout).contain('✓ nested a3 test')
    expect(stdout).contain('× a failed test')
    expect(stdout).contain('nested a failed 1 test')
  }, 120000)
})
