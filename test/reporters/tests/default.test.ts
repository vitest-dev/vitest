import { resolve } from 'pathe'
import { describe, expect, test } from 'vitest'
import { runVitest } from '../../test-utils'
import { DefaultReporter } from '../../../packages/vitest/src/node/reporters/default'

class MockDefaultReporter extends DefaultReporter {
  isTTY = true
}

const root = resolve(__dirname, '../fixtures')
async function run(fileFilter: string[]) {
  return await runVitest({
    deps: {
      inline: ['std-env'],
    },
    root,
    reporters: new MockDefaultReporter(),
    config: false,
  }, fileFilter)
}

describe('default reporter', async () => {
  test('normal', async () => {
    const { stdout } = await run(['b1.test.ts', 'b2.test.ts'])
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
