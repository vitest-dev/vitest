import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

const root = resolve(import.meta.dirname, '../fixtures/watch-trigger-pattern')

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
