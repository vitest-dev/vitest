import { test } from 'vitest'

test('annotated test', async ({ annotate }) => {
  await annotate('hello world')
  await annotate('second annotation')
})

test('annotated typed test', async ({ annotate }) => {
  await annotate('beware!', 'warning')
})

test('annotated file test', async ({ annotate }) => {
  await annotate('file annotation', {
    path: './fixtures/example.txt'
  })
})

test('annotated image test', async ({ annotate }) => {
  await annotate('image annotation', {
    path: './fixtures/cute-puppy.jpg'
  })
})

test('annotated with body', async ({ annotate }) => {
  await annotate('body annotation', {
    contentType: 'text/markdown',
    // requires pre-encoded base64 for raw string
    // https://github.com/vitest-dev/vitest/issues/9633
    body: btoa('Hello **markdown**'),
  })
})
