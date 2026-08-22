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

// The case that breaks is Vitest being *loaded* through a differently spelled
// path, which is what a local install does: `npx vitest` resolves the binary
// through the working directory, so Vitest comes from `c:\…` while Vite
// normalizes module ids to `C:/…`. Node treats the two URLs as different
// modules, and the test file used to end up importing a second copy of the
// runtime with no collector state. Depending on where the file's first call
// lands, that surfaces as "failed to find the current suite" or as
// "Cannot read properties of undefined (reading 'config')".
const spellings = {
  'a lowercase drive letter': (path: string) => path.replace(/^[A-Z]:\\/i, r => r.toLowerCase()),
  'an entirely lowercase path': (path: string) => path.toLowerCase(),
}

for (const [name, spell] of Object.entries(spellings)) {
  test.runIf(process.platform === 'win32')(`loads a single Vitest instance when the CLI is resolved through ${name}`, async () => {
    const spelledCli = spell(cli)
    // Guard the premise: on a UNC path there is no drive letter to respell and
    // the test would pass without exercising anything.
    expect(spelledCli).toMatch(/^[a-z]:\\/)

    const { stdout, stderr, exitCode } = await x('node', [spelledCli, 'run', '--no-watch', '--maxWorkers=1'], {
      nodeOptions: { cwd, env: { ...process.env, AI_AGENT: '' } },
    })

    expect(stderr).not.toContain('failed to find the current suite')
    expect(stderr).not.toContain('reading \'config\'')
    expect(stdout).toContain('1 passed')
    expect(exitCode).toBe(0)
  })
}
