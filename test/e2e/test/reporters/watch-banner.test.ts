import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { editFile, runVitest } from '../../../test-utils'

const root = resolve(import.meta.dirname, '../../fixtures/watch-banner')

test('watch banner stays FAIL while another file is failing', async () => {
  const { vitest } = await runVitest({
    root,
    watch: true,
    reporters: 'none',
  })

  await vitest.waitForStdout('Tests failed. Watching for file changes...')
  vitest.resetOutput()

  editFile(resolve(root, 'passing.test.ts'), content => `${content}\n`)

  await vitest.waitForStdout('for file changes...')

  const banner = vitest.stdout.split('\n').find(line => line.includes('for file changes'))
  expect(banner?.trim()).toMatchInlineSnapshot(`"FAIL  Tests failed. Watching for file changes..."`)
})

test('watch banner turns PASS once the failing file is fixed', async () => {
  const { vitest } = await runVitest({
    root,
    watch: true,
    reporters: 'none',
  })

  await vitest.waitForStdout('Tests failed. Watching for file changes...')
  vitest.resetOutput()

  editFile(resolve(root, 'failing.test.ts'), content => content.replace('toBe(2)', 'toBe(1)'))

  await vitest.waitForStdout('for file changes...')

  const banner = vitest.stdout.split('\n').find(line => line.includes('for file changes'))
  expect(banner?.trim()).toMatchInlineSnapshot(`"PASS  Waiting for file changes..."`)
})
