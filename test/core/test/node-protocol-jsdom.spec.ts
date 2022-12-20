// @vitest-environment jsdom

// outdated url package, which Vite will resolve to, if "url" import is used
import packageUrl from 'url'
import nodeUrl from 'node:url'
import { expect, it } from 'vitest'

it('vitest resolves both url to internal URL module in Node environment', () => {
  expect(packageUrl).not.toHaveProperty('URL')
  expect(packageUrl).not.toHaveProperty('URLSearchParams')
  expect(packageUrl).not.toHaveProperty('fileURLToPath')
  expect(nodeUrl).toHaveProperty('URL')
  expect(nodeUrl).toHaveProperty('URLSearchParams')
  expect(nodeUrl).toHaveProperty('fileURLToPath')
  // eslint-disable-next-line n/no-deprecated-api
  expect(packageUrl.parse !== nodeUrl.parse).toBe(true)
})
