import { expect, test } from 'vitest'

test('pass', async () => {
})

test('fail', async () => {
  expect(1).toBe(2)
})

test('annotation', async ({ annotate, task }) => {
  await annotate('annotation-body', {
    body: 'test-body-content',
    bodyEncoding: 'utf-8',
  })
  await annotate('annotation-path', {
    // TODO: relative to test context file by default?
    path: `${task.file.filepath}/../resources/test.txt`,
  })
})
