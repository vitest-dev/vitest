import { expect, test } from 'vitest'
import { generateFileHash } from '@vitest/runner/utils'
import { runInlineTests } from '../../test-utils'

const BASIC_TEST = `
import { test } from 'vitest'
test('t', () => {})
`

test('no blobLabel: file has no meta.blobLabel and normal id', async () => {
  const { ctx } = await runInlineTests({
    'a.test.ts': BASIC_TEST,
  })
  const files = ctx!.state.getFiles()
  expect(files).toHaveLength(1)
  expect(files[0].meta.blobLabel).toBeUndefined()
  expect(files[0].id).toBe(generateFileHash('a.test.ts', undefined))
})

test('blobLabel: file.meta.blobLabel is set and id uses label-salted hash', async () => {
  const { ctx } = await runInlineTests(
    { 'a.test.ts': BASIC_TEST },
    { blobLabel: 'linux' },
  )
  const files = ctx!.state.getFiles()
  expect(files).toHaveLength(1)
  expect(files[0].meta.blobLabel).toBe('linux')
  expect(files[0].id).toBe(generateFileHash('a.test.ts', '[linux]'))
})

test('blobLabel: child task ids derived from new file.id', async () => {
  const { ctx: noLabel } = await runInlineTests({ 'a.test.ts': BASIC_TEST })
  const { ctx: withLabel } = await runInlineTests(
    { 'a.test.ts': BASIC_TEST },
    { blobLabel: 'linux' },
  )
  const taskNoLabel = noLabel!.state.getFiles()[0].tasks[0]
  const taskWithLabel = withLabel!.state.getFiles()[0].tasks[0]
  expect(taskWithLabel.id).not.toBe(taskNoLabel.id)
  expect(taskWithLabel.id).toBe(`${withLabel!.state.getFiles()[0].id}_0`)
})
