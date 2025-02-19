// @vitest-environment node

import nodeUrl from 'node:url'
// eslint-disable-next-line unicorn/prefer-node-protocol
import packageUrl from 'url'
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
