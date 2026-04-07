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

test('annotated with body base64', async ({ annotate }) => {
  await annotate('body base64 annotation', {
    contentType: 'text/markdown',
    body: btoa('Hello base64 **markdown**'),
  })
})

test('annotated with body utf-8', async ({ annotate }) => {
  await annotate('body utf-8 annotation', {
    contentType: 'text/markdown',
    body: 'Hello utf-8 **markdown**',
    bodyEncoding: 'utf-8',
  })
})
