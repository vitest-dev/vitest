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
