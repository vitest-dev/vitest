import { describe, expect, test } from 'vitest'
import { execa } from 'execa'
import { resolve } from 'pathe'
import { cliPath } from './utils'

const entryPath = resolve(__dirname, '../src/circular/index.ts')

describe('circular', async () => {
  test('should works', async () => {
    const result = await execa('npx', ['esno', cliPath, entryPath], { reject: true })
    expect(result.stdout).toMatchInlineSnapshot('"A Bindex index"')
  }, 60_000)
})
