import type { TestRunEndReason, TestUserConfig } from 'vitest/node'
import { basename } from 'pathe'
import { expect, test } from 'vitest'
import * as testUtils from '../../test-utils'

function runVitest(config: TestUserConfig, root = './fixtures/shard') {
  return testUtils.runVitest({ ...config, root })
}

function parsePaths(stdout: string) {
  return Array.from(
    new Set(
      stdout
        .split('\n')
        .filter((line) => line && line.includes('.test.js'))
        .map((file) => basename(file.trim().split(' ')[1]))
        .sort(),
    ),
  )
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

test('--shard=1/3 should distribute files evenly', async () => {
  const { stdout } = await runVitest({ shard: '1/3' })

  const paths = parsePaths(stdout)

  // With 3 files and 3 shards, should get 1 file per shard
  expect(paths).toEqual(['1.test.js'])
})

test('--shard=2/3 should distribute files evenly', async () => {
  const { stdout } = await runVitest({ shard: '2/3' })

  const paths = parsePaths(stdout)

  // With 3 files and 3 shards, should get 1 file per shard
  expect(paths).toEqual(['2.test.js'])
})

test('--shard=3/3 should distribute files evenly', async () => {
  const { stdout } = await runVitest({ shard: '3/3' })

  const paths = parsePaths(stdout)

  // With 3 files and 3 shards, should get 1 file per shard
  expect(paths).toEqual(['3.test.js'])
})

test('4 files with 3 shards should distribute evenly', async () => {
  const { stdout: stdout1 } = await runVitest({ shard: '1/3' }, './fixtures/shard-4-files')
  const { stdout: stdout2 } = await runVitest({ shard: '2/3' }, './fixtures/shard-4-files')
  const { stdout: stdout3 } = await runVitest({ shard: '3/3' }, './fixtures/shard-4-files')

  const paths1 = parsePaths(stdout1)
  const paths2 = parsePaths(stdout2)
  const paths3 = parsePaths(stdout3)

  // Should distribute files more evenly: [2,1,1] instead of [2,2,0]
  expect(paths1.length).toBe(2)
  expect(paths2.length).toBe(1)
  expect(paths3.length).toBe(1)

  // All files should be covered exactly once
  const allFiles = [...paths1, ...paths2, ...paths3].sort()
  expect(allFiles).toEqual(['1.test.js', '2.test.js', '3.test.js', '4.test.js'])
})

test('--shard=4/4', async () => {
  const { stdout } = await runVitest({ shard: '4/4' })

  const paths = parsePaths(stdout)

  // project only has 3 files
  // shards > 3 are empty
  expect(paths).toEqual([])
})

test.each([
  { shard: '1/2', files: ['1.test.js', '2.test.js'] },
  { shard: '2/2', files: ['3.test.js'] },
])('--shard=$shard with experimental.preParse passes', async ({ shard, files }) => {
  let result: { reason: TestRunEndReason; errors: readonly unknown[]; files: string[] } | undefined

  const { stderr, exitCode } = await runVitest({
    shard,
    experimental: { preParse: true },
    reporters: [
      {
        onTestRunEnd(modules, errors, reason) {
          result = { reason, errors, files: modules.map((m) => basename(m.moduleId)).sort() }
        },
      },
    ],
  })

  expect(stderr).toBe('')
  expect(result).toEqual({ reason: 'passed', errors: [], files })
  expect(exitCode).toBe(0)
})
