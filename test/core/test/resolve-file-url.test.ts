import { expect, test } from 'vitest'

test('resolve file url', async () => {
  const fileUrl = new URL('./resolve-file-url%7Edep.js', import.meta.url).href
  const mod = await import(fileUrl)
  expect(mod.default).toMatchInlineSnapshot(`"[ok]"`)
})
