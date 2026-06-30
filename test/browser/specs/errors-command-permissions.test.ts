import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { runBrowserTests } from './utils'

// v3 backport of
// https://github.com/vitest-dev/vitest/blob/8492b6fb2/test/browser/specs/errors.test.ts#L255
test('upload is blocked for files denied by server.fs.deny', async () => {
  const root = './fixtures/command-permissions-upload-denied'
  const { stderr } = await runBrowserTests({ root })

  expect(stderr).toContain(
    `Access denied to "${resolve(process.cwd(), root, 'my-secret.txt')}".`,
  )
})

test('takeScreenshot is blocked for files denied by server.fs.deny', async () => {
  const root = './fixtures/command-permissions-screenshot-denied'
  const { stderr } = await runBrowserTests({ root })

  expect(stderr).toContain(
    `Access denied to "${resolve(process.cwd(), root, 'my-secret.png')}".`,
  )
})

test('takeScreenshot is blocked when write is disabled', async () => {
  const root = './fixtures/command-permissions-screenshot-no-write'
  const { stderr } = await runBrowserTests({ root })

  expect(stderr).toContain(
    `Cannot modify file "${resolve(process.cwd(), root, 'out.png')}". File writing is disabled because server is exposed to the internet`,
  )
})
