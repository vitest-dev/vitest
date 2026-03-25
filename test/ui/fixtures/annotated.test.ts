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
    body: btoa('Hello **markdown**'),
  })
})

test('annotated with raw body', async ({ annotate }) => {
  await annotate('raw body annotation', {
    contentType: 'text/markdown',
    body: 'Hello **markdown**',
    bodyEncoding: 'raw',
  })
})
