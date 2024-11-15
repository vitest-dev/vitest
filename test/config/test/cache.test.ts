import { resolve } from 'pathe'
import { describe, expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

const root = resolve(__dirname, '../fixtures/cache')
const project = resolve(__dirname, '../')

test('default', async () => {
  const { ctx, stdout, stderr } = await runVitest({
    root,
    include: ['*.test.ts'],
  })

  expect(stdout).toContain('✓ basic.test.ts >')
  expect(stderr).toBe('')

  const cachePath = ctx!.cache.results.getCachePath()
  const path = resolve(project, 'node_modules/.vite/results.json')
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
  const path = resolve(root, 'node_modules/.vitest-custom/results.json')
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
  const path = resolve(root, 'node_modules/.vite-custom/results.json')
  expect(cachePath).toMatch(path)
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
    const path = resolve(root, 'node_modules/.vite/vitest/results.json')
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
    const path = resolve(root, 'node_modules/.vitest-custom/results.json')
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
    const path = resolve(root, 'node_modules/.vite-custom/results.json')
    expect(cachePath).toBe(path)
  })
})
