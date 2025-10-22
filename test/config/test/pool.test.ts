import type { SerializedConfig } from 'vitest'
import type { TestUserConfig } from 'vitest/node'
import { assert, describe, expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

describe.each(['forks', 'threads', 'vmThreads', 'vmForks'])('%s', async (pool) => {
  test('resolves top-level pool', async () => {
    const config = await getConfig({ pool })

    expect(config.pool).toBe(pool)
  })
})

test('extended project inherits top-level pool related options', async () => {
  const config = await getConfig({
    projects: [{
      extends: true,
      test: { name: 'example' },
    }],
  },
  // project.extends works weirdly with runVitest(). Need to pass it here in cli options instead.
  { pool: 'threads', isolate: false })

  expect(config.pool).toBe('threads')
  expect(config.isolate).toBe(false)
})

test('project level pool options overwrites top-level', async () => {
  const config = await getConfig({
    pool: 'vmForks',
    fileParallelism: true,
    projects: [{
      extends: true,
      test: { pool: 'vmThreads', fileParallelism: false },
    }],
  })

  expect(config.pool).toBe('vmThreads')
  expect(config.fileParallelism).toBe(false)
})

async function getConfig(options: Partial<TestUserConfig>, cliOptions: Partial<TestUserConfig> = {}) {
  let config: SerializedConfig | undefined

  await runVitest({
    root: './fixtures/pool',
    include: ['print-config.test.ts'],
    ...cliOptions,
    onConsoleLog(log) {
      config = JSON.parse(log)
    },
  }, undefined, undefined, { test: options }, { })

  assert(config)
  return config
}
