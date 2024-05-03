import { expect, it } from 'vitest'
import { resolve } from 'pathe'
import ansiEscapes, { HelloWorld } from '../src/self-export'
import { runViteNodeCli } from '../../test-utils'

it('should export self', () => {
  expect(ansiEscapes.HelloWorld).eq(HelloWorld)
  expect(Reflect.get(ansiEscapes, 'default').HelloWorld).eq(HelloWorld)
  expect(HelloWorld).eq(1)
})

it('example 1', async () => {
  const entryPath = resolve(__dirname, '../src/self-export-example1.ts')
  const { viteNode } = await runViteNodeCli(entryPath)
  await viteNode.waitForStdout('Function')
}, 60_000)

it('example 2', async () => {
  const entryPath = resolve(__dirname, '../src/self-export-example2.ts')
  const { viteNode } = await runViteNodeCli(entryPath)
  await viteNode.waitForStdout('HelloWorld: 1')
}, 60_000)
