import { resolve } from 'node:path'
import { editFile, runVitest } from '#test-utils'
import { expect, test } from 'vitest'

const root = resolve(import.meta.dirname, '../../fixtures/config/watch-trigger-pattern')

test('watch trigger pattern picks up the file', async () => {
  const { stderr, vitest } = await runVitest({
    root,
    watch: true,
  })

  expect(stderr).toBe('')

  await vitest.waitForStdout('Waiting for file changes')

  editFile(
    resolve(root, 'folder/fs/text.txt'),
    content => content.replace('world', 'vitest'),
  )

  await vitest.waitForStderr('basic.test.ts')

  expect(vitest.stderr).toContain(`expected 'hello vitest\\n' to be 'hello world\\n'`)
})
