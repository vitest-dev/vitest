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

  expect(files).toContain('.tmp-1-3')
  expect(files).not.toContain('.tmp')
})
