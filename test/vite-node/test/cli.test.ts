import { execa } from 'execa'
import { resolve } from 'pathe'
import { expect, it } from 'vitest'

const cliPath = resolve(__dirname, '../../../packages/vite-node/src/cli.ts')
const entryPath = resolve(__dirname, '../src/cli-parse-args.js')

const parseResult = (s: string) => JSON.parse(s.replaceAll('\'', '"'))

it('basic', async () => {
  const result = await execa('npx', ['esno', cliPath, entryPath], { reject: true })
  expect(result.stdout).include('/node')
  expect(parseResult(result.stdout)).length(2)
}, 60_000)

it('--help', async () => {
  const r1 = await execa('npx', ['esno', cliPath, '--help', entryPath], { reject: true })
  expect(r1.stdout).include('help')
  const r2 = await execa('npx', ['esno', cliPath, '-h', entryPath], { reject: true })
  expect(r2.stdout).include('help')
}, 60_000)

it('--version', async () => {
  const r1 = await execa('npx', ['esno', cliPath, '--version', entryPath], { reject: true })
  expect(r1.stdout).include('vite-node/')
  const r2 = await execa('npx', ['esno', cliPath, '-v', entryPath], { reject: true })
  expect(r2.stdout).include('vite-node/')
}, 60_000)

it('script args', async () => {
  const r1 = await execa('npx', ['esno', cliPath, entryPath, '--version', '--help'], { reject: true })
  expect(parseResult(r1.stdout)).include('--version').include('--help')
}, 60_000)

it('script args in -- after', async () => {
  const r1 = await execa('npx', ['esno', cliPath, entryPath, '--', '--version', '--help'], { reject: true })
  expect(parseResult(r1.stdout)).include('--version').include('--help')
}, 60_000)
