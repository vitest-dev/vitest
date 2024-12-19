import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { runViteNodeCli } from '../../test-utils'

test('circular 1', async () => {
  const entryPath = resolve(__dirname, '../src/circular1/index.ts')
  const cli = await runViteNodeCli(entryPath)
  expect(cli.stdout).toContain('A Bindex index')
}, 60_000)

test('circular 2', async () => {
  const entryPath = resolve(__dirname, '../src/circular2/index.ts')
  const cli = await runViteNodeCli(entryPath)
  expect(cli.stdout).toContain('ac b')
}, 60_000)
