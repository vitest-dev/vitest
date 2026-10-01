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
    contentType: 'text/plain',
  })
  await annotate('annotation-path', {
    path: `./resources/test.txt`,
  })
})
