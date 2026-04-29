// @vitest-environment jsdom

import nodeUrl from 'node:url'
// outdated url package, which Vite will resolve to, if "url" import is used
// this should help catch bugs in source code
// eslint-disable-next-line unicorn/prefer-node-protocol
import packageUrl from 'url'
import { expect, it } from 'vitest'

it('vitest resolves url to installed url package, but node:url to internal Node module', () => {
  expect(packageUrl).not.toHaveProperty('URL')
  expect(packageUrl).not.toHaveProperty('URLSearchParams')
  expect(packageUrl).not.toHaveProperty('fileURLToPath')
  expect(nodeUrl).toHaveProperty('URL')
  expect(nodeUrl).toHaveProperty('URLSearchParams')
  expect(nodeUrl).toHaveProperty('fileURLToPath')

  // eslint-disable-next-line node/no-deprecated-api
  expect(packageUrl.parse !== nodeUrl.parse).toBe(true)
})
