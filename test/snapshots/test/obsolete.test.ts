import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from 'vitest'
import { runVitestCli } from '../../test-utils'

test('obsolete snapshot fails CI', async () => {
  // cleanup snapshot
  const root = path.join(import.meta.dirname, 'fixtures/obsolete')
  fs.rmSync(path.join(root, 'src/__snapshots__'), { recursive: true, force: true })

  // initial run to write snapshot
  let vitest = await runVitestCli('--root', root, '--update')
  expect(vitest.stdout).toContain('Snapshots  4 written')
  expect(vitest.stderr).toBe('')

  // test fails with obsolete snapshots
  // (use cli to test `updateSnapshot: 'none'`)
  vitest = await runVitestCli(
    {
      nodeOptions: {
        env: {
          CI: 'true',
          TEST_OBSOLETE: 'true',
        },
      },
    },
    '--root',
    root,
  )
  expect(vitest.stdout).toContain('1 obsolete')
  expect(vitest.stdout).toContain('Test Files  1 failed | 1 passed')
  expect(vitest.stdout).toContain('Tests  4 passed')
  expect(vitest.stderr).toContain(`Error: Obsolete snapshots found: foo 1`)
  expect(vitest.exitCode).toBe(1)
})
