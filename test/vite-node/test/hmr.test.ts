import { test } from 'vitest'
import { resolve } from 'pathe'
import { editFile, runViteNodeCli } from '../../test-utils'

test('hmr.accept works correctly', async () => {
  const scriptFile = resolve(__dirname, '../src/hmr-script.js')

  const viteNode = await runViteNodeCli('--watch', scriptFile)

  await viteNode.waitForStderr('Hello!')

  const promises = [
    viteNode.waitForStderr('Hello world!'),
    viteNode.waitForStderr('Accept'),
    viteNode.waitForStdout(`[vite-node] hot updated: ${scriptFile}`),
  ]
  editFile(scriptFile, content => content.replace('Hello!', 'Hello world!'))
  await Promise.all(promises)
})
