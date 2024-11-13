import { join } from 'pathe'
import { expect, test } from 'vitest'
import { runVitestCli } from '../../test-utils'

const _DRIVE_LETTER_START_RE = /^[A-Z]:\//i
const root = join(import.meta.dirname, '../fixtures/windows-drive-case')
const cwd = root.replace(_DRIVE_LETTER_START_RE, r => r.toLowerCase())

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
