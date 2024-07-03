import { readdirSync } from 'node:fs'
import { expect } from 'vitest'
import { coverageTest, normalizeURL, runVitest, test } from '../utils'

test('{ shard: 1/4 }', async () => {
  await runVitest({
    include: [normalizeURL(import.meta.url)],
    shard: '1/4',
  })
})

coverageTest('temporary directory is postfixed with --shard value', () => {
  const files = readdirSync('./coverage')

  expect(files).toContain('.tmp-1-4')
  expect(files).not.toContain('.tmp')
})
