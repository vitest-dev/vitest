import type { ViteUserConfig } from 'vitest/config'
import { unlinkSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { expect, it, onTestFinished } from 'vitest'

it('write file and import created file it should return created content.', async () => {
  // @ts-expect-error -- internal
  const config: NonNullable<ViteUserConfig['test']> = globalThis.__vitest_worker__.config

  // This test can run parallel on multiple projects - namespace the file to avoid conflicts
  const filename = `${config.name}-bar.js`

  onTestFinished(() => unlinkSync(filename))

  writeFileSync(filename, 'export default 123')

  const mod = await import(pathToFileURL(filename).href)

  expect(mod.default).toBe(123)
})
