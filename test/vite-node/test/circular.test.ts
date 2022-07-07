import { describe, expect, test } from 'vitest'
import { execa } from 'execa'
import { resolve } from 'pathe'

const cliPath = resolve(__dirname, '../../../packages/vite-node/src/cli.ts')
const entryPath = resolve(__dirname, '../src/circular/index.ts')

describe('circular', async () => {
  test('should works', async () => {
    const result = await execa('npx', ['esno', cliPath, entryPath], { reject: true })
    expect(result.stdout).toMatchInlineSnapshot('"A Bindex index"')
  })
})
