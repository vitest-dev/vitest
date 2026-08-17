import { expect, it } from 'vitest'
import * as https from 'node:https'
import * as timers from 'node:timers'
import * as path from 'node:path'
import * as fs from 'node:fs'

// Regression test for https://github.com/vitest-dev/vitest/issues/10795
// MSW (and similar tools) patch the module returned by require(), and expect
// the same patched module to be used by ESM imports. This test verifies that
// `import * as mod from 'node:mod'` returns the same object as `require('node:mod')`.
it('import * as node:https returns same object as require', () => {
  const httpsRequire = require('node:https')
  expect(https).toBe(httpsRequire)
  expect(https.get).toBe(httpsRequire.get)
  expect(https.request).toBe(httpsRequire.request)
})

it('import * as node:timers returns same object as require', () => {
  const timersRequire = require('node:timers')
  expect(timers).toBe(timersRequire)
  expect(timers.setTimeout).toBe(timersRequire.setTimeout)
  expect(timers.setInterval).toBe(timersRequire.setInterval)
})

it('import * as node:path returns same object as require', () => {
  const pathRequire = require('node:path')
  expect(path).toBe(pathRequire)
  expect(path.join).toBe(pathRequire.join)
  expect(path.resolve).toBe(pathRequire.resolve)
})

it('import * as node:fs returns same object as require', () => {
  const fsRequire = require('node:fs')
  expect(fs).toBe(fsRequire)
  expect(fs.readFileSync).toBe(fsRequire.readFileSync)
})
