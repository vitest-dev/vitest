import fs from 'node:fs'
import { expect, test } from 'vitest'

const allowExternal = import.meta.env.VITE_COVERAGE_ALLOW_EXTERNAL

test.skipIf(!allowExternal)('{ allowExternal: true } includes files outside project root', async () => {
  expect(fs.existsSync('./coverage/test-utils/fixtures/math.ts.html')).toBe(true)

  // Files inside project root should always be included
  expect(fs.existsSync('./coverage/coverage-test/src/utils.ts.html')).toBe(true)
})

test.skipIf(allowExternal)('{ allowExternal: false } excludes files outside project root', async () => {
  expect(fs.existsSync('./coverage/test-utils/fixtures/math.ts.html')).toBe(false)
  expect(fs.existsSync('./test-utils/fixtures/math.ts.html')).toBe(false)
  expect(fs.existsSync('./fixtures/math.ts.html')).toBe(false)

  // Files inside project root should always be included
  expect(fs.existsSync('./coverage/utils.ts.html')).toBe(true)
})
