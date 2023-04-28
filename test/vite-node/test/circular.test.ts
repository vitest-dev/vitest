import { expect, test } from 'vitest'
import { execa } from 'execa'
import { resolve } from 'pathe'

const cliPath = resolve(__dirname, '../../../packages/vite-node/src/cli.ts')

test('circular 1', async () => {
  const entryPath = resolve(__dirname, '../src/circular1/index.ts')
  const result = await execa('npx', ['esno', cliPath, entryPath], { reject: true })
  expect(result.stdout).toMatchInlineSnapshot('"A Bindex index"')
}, 60_000)

test('circular 2', async () => {
  const entryPath = resolve(__dirname, '../src/circular2/index.ts')
  const result = await execa('npx', ['esno', cliPath, entryPath], { reject: true })
  expect(result.stdout).toMatchInlineSnapshot('"ac b"')
}, 60_000)
