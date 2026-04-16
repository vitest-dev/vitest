import { expect, test } from 'vitest'

test('simple example', async ({ bench }) => {
  await bench('1 + 1', () => {
    const result = 1 + 1
    expect.assert(result === 2)
  }).run()
})
