// @vitest-environment node

import packageUrl from 'url'
import nodeUrl from 'node:url'
import { expect, it } from 'vitest'

it('vitest resolves both "url" and "node:url" to internal URL module in Node environment', () => {
  expect(packageUrl).toHaveProperty('URL')
  expect(packageUrl).toHaveProperty('URLSearchParams')
  expect(packageUrl).toHaveProperty('fileURLToPath')
  expect(nodeUrl).toHaveProperty('URL')
  expect(nodeUrl).toHaveProperty('URLSearchParams')
  expect(nodeUrl).toHaveProperty('fileURLToPath')
  expect(packageUrl.URL === nodeUrl.URL).toBe(true)
})
