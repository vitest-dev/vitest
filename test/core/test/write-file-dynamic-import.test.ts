import { unlinkSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, it } from 'vitest'

const filename = 'bar.js'

afterEach(() => unlinkSync(filename))

it('write file and import created file it should return created content.', async () => {
  writeFileSync(filename, 'export default 123')

  const mod = await import(pathToFileURL(filename).href)

  expect(mod.default).toBe(123)
})
