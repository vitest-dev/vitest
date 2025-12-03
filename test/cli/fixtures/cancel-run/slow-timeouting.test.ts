import { test } from 'vitest'

test('slow timeouting test', { timeout: 30_000 }, async () => {
  console.log("Running slow timeouting test")
  await new Promise(resolve => setTimeout(resolve, 40_000))
})
