import type { UserConfig } from 'vitest/node'
import { basename } from 'pathe'

import { expect, test } from 'vitest'
import * as testUtils from '../../test-utils'

function runVitest(config: UserConfig) {
  return testUtils.runVitest({ ...config, root: './fixtures/shard' })
}

function parsePaths(stdout: string) {
  return Array.from(new Set(stdout
    .split('\n')
    .filter(line => line && line.includes('.test.js'))
    .map(file => basename(file.trim().split(' ')[1]))
    .sort()))
}

test('--shard=1/1', async () => {
  const { stdout } = await runVitest({ shard: '1/1' })

  const paths = parsePaths(stdout)

  expect(paths).toEqual(['1.test.js', '2.test.js', '3.test.js'])
})

test('--shard=1/2', async () => {
  const { stdout } = await runVitest({ shard: '1/2' })

  const paths = parsePaths(stdout)

  expect(paths).toEqual(['1.test.js', '2.test.js'])
})

test('--shard=2/2', async () => {
  const { stdout } = await runVitest({ shard: '2/2' })

  const paths = parsePaths(stdout)

  expect(paths).toEqual(['3.test.js'])
})

test('--shard=4/4', async () => {
  const { stdout } = await runVitest({ shard: '4/4' })

  const paths = parsePaths(stdout)

  // project only has 3 files
  // shards > 3 are empty
  expect(paths).toEqual([])
})
