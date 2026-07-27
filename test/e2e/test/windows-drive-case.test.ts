import { fileURLToPath } from 'node:url'
import { join } from 'pathe'
import { x } from 'tinyexec'
import { expect, test } from 'vitest'
import { runVitestCli } from '../../test-utils'

const _DRIVE_LETTER_START_RE = /^[A-Z]:\//i
const root = join(import.meta.dirname, '../fixtures/windows-drive-case')
const cwd = root.replace(_DRIVE_LETTER_START_RE, r => r.toLowerCase())
const cli = fileURLToPath(new URL('../../../packages/vitest/vitest.mjs', import.meta.url))

test.runIf(process.platform === 'win32')(`works on windows with a lowercase drive: ${cwd}`, async () => {
  const { stderr, stdout } = await runVitestCli({
    nodeOptions: {
      cwd,
    },
  }, '--no-watch')

  expect(cwd[0]).toEqual(cwd[0].toLowerCase())
  expect(stderr).toBe('')
  expect(stdout).toContain('1 passed')
})

// Running the CLI through a lowercase drive is what happens with a local
// install: `npx vitest` resolves the binary through the working directory, so
// Vitest is loaded from `c:\…` while Vite normalizes module ids to `C:/…`.
// Node treats the two URLs as different modules, and the test file used to end
// up importing a second copy of the runtime with no collector state.
test.runIf(process.platform === 'win32')('loads a single Vitest instance when the CLI is resolved through a lowercase drive', async () => {
  const lowercaseCli = cli.replace(/^[A-Z]:\\/i, r => r.toLowerCase())
  const { stdout, stderr } = await x('node', [lowercaseCli, 'run', '--no-watch', '--maxWorkers=1'], {
    nodeOptions: { cwd, env: { ...process.env, AI_AGENT: '' } },
  })

  expect(lowercaseCli[0]).toEqual(lowercaseCli[0].toLowerCase())
  expect(stderr).not.toContain('failed to find the current suite')
  expect(stdout).toContain('1 passed')
})
