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
