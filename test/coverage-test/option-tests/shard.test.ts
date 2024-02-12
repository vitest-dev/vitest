import { readdirSync } from 'node:fs'
import { expect, test } from 'vitest'

test('temporary directory is postfixed with --shard value', () => {
  const files = readdirSync('./coverage')

  expect(files).toContain('.tmp-1-4')
  expect(files).not.toContain('.tmp')
})
