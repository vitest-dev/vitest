import { test } from 'vitest'

test('other', async () => {
  await new Promise(r => setTimeout(r, 150))
})
