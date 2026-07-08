import { expect, test } from 'vitest'

import { createFile, resolvePath, runInlineTests, runVitest } from '../../test-utils'

test('importing files in restricted fs works correctly', async () => {
  createFile(
    resolvePath(import.meta.url, '../fixtures/vm-threads/src/external/package-null/package-null.json'),
    'null',
  )

  const { stderr, exitCode } = await runVitest({
    root: './fixtures/vm-threads',
  })

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})

// compiled scripts of inlined modules are shared between vm contexts within
// a worker — module state must still be re-evaluated per test file. With 4
// files on 2 workers, at least one worker runs several files, so a leak of
// evaluated state through the shared script would fail the second file.
test.for(['vmThreads', 'vmForks'] as const)(
  '%s re-evaluates inlined modules in every context',
  async (pool) => {
    const testFile = `
      import { expect, test } from 'vitest'
      import { increment } from './counter.js'

      test('module state is fresh for this file', () => {
        expect(increment()).toBe(1)
      })
    `
    const { stderr, exitCode } = await runInlineTests({
      'counter.js': `
        let count = 0
        export function increment() {
          return ++count
        }
      `,
      'a.test.js': testFile,
      'b.test.js': testFile,
      'c.test.js': testFile,
      'd.test.js': testFile,
    }, {
      pool,
      maxWorkers: 2,
    })

    expect(stderr).toBe('')
    expect(exitCode).toBe(0)
  },
)

// the graph prewarm triggered by vm workers swallows its own transform
// errors — the worker's fetch must still report them with the import context
test('vm pools report errors from modules covered by the graph prewarm', async () => {
  const { stderr, exitCode } = await runInlineTests({
    'a.test.js': `
      import './does-not-exist.js'
      import { test } from 'vitest'

      test('never runs', () => {})
    `,
  }, {
    pool: 'vmThreads',
  })

  expect(exitCode).toBe(1)
  expect(stderr).toContain('does-not-exist.js')
})

// The module-sync condition was added in Node 22.12/20.19 when require(esm)
// was unflagged. The fix uses the _resolveFilename conditions option which
// is only available on Node 22.12+. Node 20 is unfixable and reaches EOL
// April 2026.
const nodeMajor = Number(process.versions.node.split('.')[0])
test.skipIf(nodeMajor < 22)('can require package with module-sync exports condition', async () => {
  const { stderr, exitCode } = await runInlineTests({
    // .mjs module-sync entry
    'node_modules/module-sync-mjs/package.json': JSON.stringify({
      name: 'module-sync-mjs',
      exports: {
        '.': {
          'module-sync': './index.mjs',
          'require': './index.cjs',
        },
      },
    }),
    'node_modules/module-sync-mjs/index.mjs': 'export const value = "esm";',
    'node_modules/module-sync-mjs/index.cjs': 'module.exports = { value: "cjs" };',
    // .js module-sync entry with "type": "module"
    'node_modules/module-sync-js/package.json': JSON.stringify({
      name: 'module-sync-js',
      type: 'module',
      exports: {
        '.': {
          'module-sync': './index.js',
          'require': './index.cjs',
        },
      },
    }),
    'node_modules/module-sync-js/index.js': 'export const value = "esm";',
    'node_modules/module-sync-js/index.cjs': 'module.exports = { value: "cjs" };',
    'basic.test.js': `
      import { createRequire } from 'node:module'
      import { expect, test } from 'vitest'

      const require = createRequire(import.meta.url)

      test('require loads cjs entry for module-sync package (.mjs)', () => {
        const mod = require('module-sync-mjs')
        expect(mod.value).toBe('cjs')
      })

      test('require loads cjs entry for module-sync package (.js with type: module)', () => {
        const mod = require('module-sync-js')
        expect(mod.value).toBe('cjs')
      })
    `,
  }, {
    pool: 'vmThreads',
  })

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})
