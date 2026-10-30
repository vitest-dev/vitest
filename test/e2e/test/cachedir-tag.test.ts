import { readFileSync } from 'node:fs'
import { dirname, join } from 'pathe'
import { expect, test } from 'vitest'
import { runInlineTests } from '#test-utils'

const SIGNATURE = 'Signature: 8a477f597d28d172789f06886806bc55'

const passingTest = /* js */ `
import { test } from 'vitest'
test('passes', () => {})
`

function readTag(dir: string) {
  return readFileSync(join(dir, 'CACHEDIR.TAG'), 'utf-8')
}

test('tags the results cache and the fs module caches', async () => {
  const { ctx, root, stderr } = await runInlineTests(
    {
      'unit/basic.test.js': passingTest,
      'api/basic.test.js': passingTest,
      'vitest.config.js': {
        test: {
          fsModuleCache: true,
          fsModuleCachePath: './node_modules/.vitest-fs-cache',
          projects: [
            { test: { name: 'unit', include: ['unit/*.test.js'] } },
            {
              test: {
                name: 'api',
                include: ['api/*.test.js'],
                fsModuleCachePath: './node_modules/.vitest-api-cache',
              },
            },
          ],
        },
      },
    },
    { cache: true },
  )
  expect(stderr).toBe('')

  // the results are in "cacheDir/vitest/<hash>", Vitest owns "cacheDir/vitest"
  const vitestCacheDir = dirname(ctx!.viteConfig.cacheDir)
  expect(vitestCacheDir).toBe(join(root, 'node_modules/.vite/vitest'))
  const tag = readTag(vitestCacheDir)
  expect(tag).toMatchInlineSnapshot(`
    "Signature: 8a477f597d28d172789f06886806bc55
    # This file is a cache directory tag created by Vitest.
    # For information about cache directory tags see https://bford.info/cachedir/
    "
  `)
  expect(readTag(join(root, 'node_modules/.vitest-fs-cache'))).toBe(tag)
  expect(readTag(join(root, 'node_modules/.vitest-api-cache'))).toBe(tag)
})

test('keeps an existing tag', async () => {
  const customTag = `${SIGNATURE}\n# custom\n`
  const { root, stderr } = await runInlineTests(
    {
      'basic.test.js': passingTest,
      'node_modules/.vite/vitest/CACHEDIR.TAG': customTag,
      'node_modules/.vitest-fs-cache/CACHEDIR.TAG': customTag,
      'vitest.config.js': {
        test: {
          fsModuleCache: true,
          fsModuleCachePath: './node_modules/.vitest-fs-cache',
        },
      },
    },
    { cache: true },
  )
  expect(stderr).toBe('')
  expect(readTag(join(root, 'node_modules/.vite/vitest'))).toBe(customTag)
  expect(readTag(join(root, 'node_modules/.vitest-fs-cache'))).toBe(customTag)
})
