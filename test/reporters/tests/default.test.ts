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
    expect(stdout.split('\n').slice(2, -4).join('\n')).toMatchSnapshot()
  }, 120000)

  test('show full test suite when only one file', async () => {
    const { stdout } = await run(['a.test.ts'])
    expect(stdout.split('\n').slice(2, -4).join('\n')).toMatchSnapshot()
  }, 120000)
})
