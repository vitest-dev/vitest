import { test } from 'vitest'
import { resolve } from 'pathe'
import { editFile, runViteNodeCli } from '../../test-utils'

test('hmr.accept works correctly', async () => {
  const scriptFile = resolve(__dirname, '../src/script.js')

  const viteNode = await runViteNodeCli(scriptFile, '--watch')

  await viteNode.waitForStderr('Hello!')

  editFile(scriptFile, content => content.replace('Hello!', 'Hello world!'))

  await viteNode.waitForStderr('Hello world!')
  await viteNode.waitForStderr('Accept')
  await viteNode.waitForStdout(`[vite-node] hot updated: ${scriptFile}`)
})
