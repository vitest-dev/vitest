import { resolve } from 'pathe'
import { test } from 'vitest'
import { editFile, runViteNodeCli } from '../../test-utils'

test('hmr.accept works correctly', async () => {
  const scriptFile = resolve(__dirname, '../src/hmr-script.js')

  const { viteNode } = await runViteNodeCli('--watch', scriptFile)

  await viteNode.waitForStderr('Hello!')

  editFile(scriptFile, content => content.replace('Hello!', 'Hello world!'))

  await viteNode.waitForStderr('Hello world!')
  await viteNode.waitForStderr('Accept')
  await viteNode.waitForStdout(`[vite-node] hot updated: ${scriptFile}`)
})

test('can handle top-level throw in self-accepting module', async () => {
  const scriptFile = resolve(__dirname, '../src/hmr-throw.js')

  const { viteNode } = await runViteNodeCli('--watch', scriptFile)

  await viteNode.waitForStderr('ready')

  editFile(scriptFile, content => `${content}\nconsole.error("done")`)

  await viteNode.waitForStderr('some error')
  await viteNode.waitForStderr(`[hmr] Failed to reload ${scriptFile}. This could be due to syntax errors or importing non-existent modules. (see errors above)`)
})
