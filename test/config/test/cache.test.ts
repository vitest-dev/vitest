import { readFileSync } from 'node:fs'
import { resolve } from 'pathe'
import { describe, expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

const root = resolve(__dirname, '../fixtures/cache')

test('default', async () => {
  const { ctx, stdout, stderr } = await runVitest({
    root,
    include: ['*.test.ts'],
  })

  expect(stdout).toContain('✓ basic.test.ts >')
  expect(stderr).toBe('')

  const cachePath = ctx!.cache.results.getCachePath()
  const path = resolve(root, 'node_modules/.vite/vitest/da39a3ee5e6b4b0d3255bfef95601890afd80709/results.json')
  expect(cachePath).toMatch(path)
})

test('use cache.dir', async () => {
  const { ctx, stdout, stderr } = await runVitest(
    {
      root,
      include: ['*.test.ts'],
      cache: {
        dir: 'node_modules/.vitest-custom',
      },
    },
  )

  expect(stdout).toContain('✓ basic.test.ts >')
  expect(stderr).toContain('"cache.dir" is deprecated')

  const cachePath = ctx!.cache.results.getCachePath()
  const path = resolve(root, 'node_modules/.vitest-custom/vitest/da39a3ee5e6b4b0d3255bfef95601890afd80709/results.json')
  expect(cachePath).toMatch(path)
})

test('use cacheDir', async () => {
  const { ctx, stdout, stderr } = await runVitest(
    {
      root,
      include: ['*.test.ts'],
    },
    [],
    'test',
    { cacheDir: 'node_modules/.vite-custom' },
  )

  expect(stdout).toContain('✓ basic.test.ts >')
  expect(stderr).toBe('')

  const cachePath = ctx!.cache.results.getCachePath()
  const path = resolve(root, 'node_modules/.vite-custom/vitest/da39a3ee5e6b4b0d3255bfef95601890afd80709/results.json')
  expect(cachePath).toMatch(path)
})

test('preserves previous test results', async () => {
  const firstRun = await runVitest({
    root,
    include: ['basic.test.ts'],
  })

  expect(firstRun.stdout).toContain('✓ basic.test.ts >')
  expect(firstRun.stderr).toBe('')

  const cachePath = firstRun.ctx!.cache.results.getCachePath()
  const firstRunCacheContent = readFileSync(cachePath!, 'utf-8')
  expect(firstRunCacheContent).toContain('basic.test.ts')

  const secondRun = await runVitest({
    root,
    include: ['second.test.ts'],
  })
  expect(secondRun.stdout).toContain('✓ second.test.ts >')
  expect(secondRun.stderr).toBe('')

  const secondRunCacheContent = readFileSync(cachePath!, 'utf-8')
  expect(secondRunCacheContent).toContain('basic.test.ts')
  expect(secondRunCacheContent).toContain('second.test.ts')
})

describe('with optimizer enabled', () => {
  const deps = {
    optimizer: {
      web: {
        enabled: true,
      },
    },
  }

  test('default', async () => {
    const { ctx, stdout, stderr } = await runVitest({
      root,
      include: ['*.test.ts'],
      deps,
    })

    expect(stdout).toContain('✓ basic.test.ts >')
    expect(stderr).toBe('')

    const cachePath = ctx!.cache.results.getCachePath()
    const path = resolve(root, 'node_modules/.vite/vitest/da39a3ee5e6b4b0d3255bfef95601890afd80709/results.json')
    expect(cachePath).toBe(path)
  })

  test('use cache.dir', async () => {
    const { ctx, stdout, stderr } = await runVitest(
      {
        root,
        include: ['*.test.ts'],
        deps,
        cache: {
          dir: 'node_modules/.vitest-custom',
        },
      },
    )

    expect(stdout).toContain('✓ basic.test.ts >')
    expect(stderr).toContain('"cache.dir" is deprecated')

    const cachePath = ctx!.cache.results.getCachePath()
    const path = resolve(root, 'node_modules/.vitest-custom/vitest/da39a3ee5e6b4b0d3255bfef95601890afd80709/results.json')
    expect(cachePath).toBe(path)
  })

  test('use cacheDir', async () => {
    const { ctx, stdout, stderr } = await runVitest(
      {
        root,
        include: ['*.test.ts'],
        deps,
      },
      [],
      'test',
      { cacheDir: 'node_modules/.vite-custom' },
    )

    expect(stdout).toContain('✓ basic.test.ts >')
    expect(stderr).toBe('')

    const cachePath = ctx!.cache.results.getCachePath()
    const path = resolve(root, 'node_modules/.vite-custom/vitest/da39a3ee5e6b4b0d3255bfef95601890afd80709/results.json')
    expect(cachePath).toBe(path)
  })
})
