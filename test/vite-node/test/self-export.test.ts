import { expect, it } from 'vitest'
import { execa } from 'execa'
import { resolve } from 'pathe'
import ansiEscapes, { HelloWorld } from '../src/self-export'

it('should export self', () => {
  expect(ansiEscapes.HelloWorld).eq(HelloWorld)
  expect(Reflect.get(ansiEscapes, 'default').HelloWorld).eq(HelloWorld)
  expect(HelloWorld).eq(1)
})

const cliPath = resolve(__dirname, '../../../packages/vite-node/src/cli.ts')

it('example 1', async () => {
  const entryPath = resolve(__dirname, '../src/self-export-example1.ts')
  const result = await execa('npx', ['esno', cliPath, entryPath], { reject: true })
  expect(result.stdout).includes('Function')
}, 60_000)

it('example 2', async () => {
  const entryPath = resolve(__dirname, '../src/self-export-example2.ts')
  const result = await execa('npx', ['esno', cliPath, entryPath], { reject: true })
  expect(result.stdout).includes('HelloWorld: 1').includes('default')
}, 60_000)
