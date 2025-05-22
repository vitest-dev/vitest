import { test } from 'vitest'

test('annotations example', async ({ annotate }) => {
  await annotate('a simple message')
  await annotate('good boy', { path: './cute-puppy.jpg' })
})
