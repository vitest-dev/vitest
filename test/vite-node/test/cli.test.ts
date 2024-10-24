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

it('exposes .env variables', async () => {
  const { stdout } = await runViteNodeCli(resolve(__dirname, '../src/cli-print-env.js'))
  const env = JSON.parse(stdout)
  expect(env.MY_TEST_ENV).toBe('hello')
})

it.each(['index.js', 'index.cjs', 'index.mjs'])('correctly runs --watch %s', async (file) => {
  const entryPath = resolve(__dirname, '../src/watch', file)
  const { viteNode } = await runViteNodeCli('--watch', entryPath)
  await viteNode.waitForStdout('test 1')
  editFile(entryPath, c => c.replace('test 1', 'test 2'))
  await viteNode.waitForStdout('test 2')
})

it('invalidate source map cache', async () => {
  const entryPath = resolve(__dirname, '../src/watch/source-map.ts')
  const { viteNode } = await runViteNodeCli('--watch', entryPath)
  await viteNode.waitForStdout('source-map.ts:7:11')
  editFile(entryPath, c => c.replaceAll('    // 2\n', ''))
  await viteNode.waitForStdout('source-map.ts:5:11')
})
