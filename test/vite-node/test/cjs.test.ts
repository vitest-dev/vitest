import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { it } from 'vitest'

const execFileAsync = promisify(execFile)

it('require vite-node', async () => {
  // verify `import.meta.resolve` usage doesn't cause syntax error on vite-node cjs build
  // since rollup replaces it with `undefined`
  await execFileAsync(
    'node',
    [fileURLToPath(new URL('../src/require-vite-node.cjs', import.meta.url))],
  )
})
