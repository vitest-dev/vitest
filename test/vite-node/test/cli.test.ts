import { resolve } from 'pathe'
import pkg from 'vite-node/package.json'
import { expect, it } from 'vitest'
import { editFile, runViteNodeCli } from '../../test-utils'

const entryPath = resolve(__dirname, '../src/cli-parse-args.js')

const version = (pkg as any).version

const parseResult = (s: string) => JSON.parse(s.replaceAll('\'', '"'))

it('basic', async () => {
  const cli = await runViteNodeCli(entryPath)
  expect(cli.stdout).toContain('node')
  expect(parseResult(cli.stdout)).toHaveLength(2)
})

it('--help', async () => {
  const cli1 = await runViteNodeCli('--help', entryPath)
  expect(cli1.stdout).toContain('Usage:')
  const cli2 = await runViteNodeCli('-h', entryPath)
  expect(cli2.stdout).toContain('Usage:')
})

it('--version', async () => {
  const cli1 = await runViteNodeCli('--version', entryPath)
  expect(cli1.stdout).toContain(`vite-node/${version}`)
  const cli2 = await runViteNodeCli('-v', entryPath)
  expect(cli2.stdout).toContain(`vite-node/${version}`)
})

it('script args', async () => {
  const cli1 = await runViteNodeCli(entryPath, '--version', '--help')
  expect(parseResult(cli1.stdout)).include('--version').include('--help')
})

it('script args in -- after', async () => {
  const cli1 = await runViteNodeCli(entryPath, '--', '--version', '--help')
  expect(parseResult(cli1.stdout)).include('--version').include('--help')
})

it.each(['index.js', 'index.cjs', 'index.mjs'])('correctly runs --watch %s', async (file) => {
  const entryPath = resolve(__dirname, '../src/watch', file)
  const cli = await runViteNodeCli('--watch', entryPath)
  await cli.waitForStdout('test 1')
  editFile(entryPath, c => c.replace('test 1', 'test 2'))
  await cli.waitForStdout('test 2')
})
