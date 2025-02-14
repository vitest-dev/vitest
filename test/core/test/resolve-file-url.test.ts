import { expect, test } from 'vitest'

test('resolve file url', async () => {
  const fileUrl = new URL('./resolve-file-url%7Edep.js', import.meta.url).href
  const mod = await import(fileUrl)
  expect(mod.default).toMatchInlineSnapshot(`"[ok]"`)

  const mod2 = await import(`${fileUrl}#hash=test`)
  expect(mod2).toEqual(mod)
  expect(mod2).not.toBe(mod)

  const mod3 = await import(`${fileUrl}?query=test`)
  expect(mod3).toEqual(mod)
  expect(mod3).not.toBe(mod)
})
