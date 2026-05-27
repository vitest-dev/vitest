import { readdirSync } from 'node:fs'
import { expect } from 'vitest'
import { coverageTest, normalizeURL, runVitest, test } from '../utils'

test('{ shard: 1/3 }', async () => {
  await runVitest({
    include: [normalizeURL(import.meta.url), 'fixtures/test/math.test.ts', 'fixtures/test/even.test.ts'],
    shard: '1/3',
  })
})

coverageTest('temporary directory is postfixed with --shard value', () => {
  const files = readdirSync('./coverage')

  // T-01: temp dir is now named '.tmp-<shard-index>-<shard-count>-<nanoid>'
  expect(files.some(f => f.startsWith('.tmp-1-3'))).toBe(true)
  expect(files).not.toContain('.tmp')

  // AC-3: assert that the temp dir carries a unique per-run segment
  expect(files.some(f => /^\.tmp(?:-1-3)?-[\w-]+$/.test(f))).toBe(true)
})
