import { replaceRoot, runInlineTests, ts } from '#test-utils'
import { expect, test } from 'vitest'

const pools = ['forks', 'vmThreads'] as const

test.for(pools)('cjs globals are injected by default (%s)', async (pool) => {
  const { stderr, exitCode } = await runInlineTests({
    'basic.test.js': ts`
      import { expect, test } from 'vitest'

      test('cjs globals are defined', () => {
        expect(typeof module).toBe('object')
        expect(typeof exports).toBe('object')
        expect(typeof require).toBe('function')
        expect(typeof __filename).toBe('string')
        expect(typeof __dirname).toBe('string')
      })
    `,
  }, { pool })
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})

test.for(pools)('cjs globals are not injected into ES modules when injectCjsGlobals is disabled (%s)', async (pool) => {
  const { stderr, exitCode } = await runInlineTests({
    'basic.test.js': ts`
      import { expect, test } from 'vitest'

      test('cjs globals are not defined', () => {
        expect(typeof module).toBe('undefined')
        expect(typeof exports).toBe('undefined')
        expect(typeof require).toBe('undefined')
        expect(typeof __filename).toBe('undefined')
        expect(typeof __dirname).toBe('undefined')
        expect(() => __dirname).toThrowError(ReferenceError)
      })
    `,
  }, { pool, injectCjsGlobals: false })
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})

test.for(pools)('inlined ".cjs" modules keep the module scope when injectCjsGlobals is disabled (%s)', async (pool) => {
  const { stderr, exitCode } = await runInlineTests({
    'cjs-dep.cjs': ts`
      module.exports = {
        answer: 42,
        filename: __filename,
      }
    `,
    'basic.test.js': ts`
      import { expect, test } from 'vitest'
      import cjs from './cjs-dep.cjs'

      test('cjs module is evaluated', () => {
        expect(cjs.answer).toBe(42)
        expect(cjs.filename).toContain('cjs-dep.cjs')
        expect(typeof module).toBe('undefined')
      })
    `,
  }, { pool, injectCjsGlobals: false })
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})

test('".js" modules without ESM syntax are detected as commonjs in a typeless package', async () => {
  const { stderr, exitCode } = await runInlineTests({
    'package.json': '{}',
    'cjs-dep.js': ts`
      module.exports = { answer: 42 }
    `,
    'basic.test.js': ts`
      import { expect, test } from 'vitest'
      import cjs from './cjs-dep.js'

      test('cjs module is evaluated, the test file is strict', () => {
        expect(cjs.answer).toBe(42)
        expect(typeof module).toBe('undefined')
        expect(typeof __dirname).toBe('undefined')
      })
    `,
  }, { injectCjsGlobals: false })
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})

test('"type": "commonjs" in package.json keeps the module scope when injectCjsGlobals is disabled', async () => {
  const { stderr, exitCode } = await runInlineTests({
    'package.json': '{ "type": "commonjs" }',
    'basic.test.js': ts`
      import { expect, test } from 'vitest'

      test('cjs globals are defined', () => {
        expect(typeof module).toBe('object')
        expect(typeof exports).toBe('object')
        expect(typeof require).toBe('function')
        expect(typeof __filename).toBe('string')
        expect(typeof __dirname).toBe('string')
      })
    `,
  }, { injectCjsGlobals: false })
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})

test('esm markers inside comments do not affect the detection', async () => {
  const { stderr, exitCode } = await runInlineTests({
    'package.json': '{}',
    'cjs-dep.js': ts`
      // this module mentions __vite_ssr_import__ and __vite_ssr_exports__ in a comment
      module.exports = { answer: 42 }
    `,
    'basic.test.js': ts`
      // the marker __vite_ssr_import__ in a comment doesn't make a real ES module less strict
      import { expect, test } from 'vitest'
      import cjs from './cjs-dep.js'

      test('cjs module is evaluated, the test file is strict', () => {
        expect(cjs.answer).toBe(42)
        expect(typeof module).toBe('undefined')
      })
    `,
  }, { injectCjsGlobals: false })
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})

test('typescript file with only type imports is detected as commonjs', async () => {
  const { stderr, exitCode } = await runInlineTests({
    'package.json': '{}',
    'cjs-dep.ts': ts`
      import type { Stats } from 'node:fs'

      module.exports = {
        dirname: __dirname,
        isStats: (stats: Stats) => stats instanceof Object,
      }
    `,
    'basic.test.js': ts`
      import { expect, test } from 'vitest'
      import cjs from './cjs-dep.ts'

      test('cjs module is evaluated', () => {
        expect(typeof cjs.dirname).toBe('string')
        expect(cjs.isStats({})).toBe(true)
      })
    `,
  }, { injectCjsGlobals: false })
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})

test('typeless files inside node_modules do not inherit the project package type', async () => {
  const { stderr, exitCode } = await runInlineTests({
    'package.json': '{ "type": "module" }',
    'node_modules/raw-dep/index.js': ts`
      module.exports = { answer: 42 }
    `,
    'basic.test.js': ts`
      import { expect, test } from 'vitest'
      import cjs from './node_modules/raw-dep/index.js'

      test('cjs module is evaluated, the test file is strict', () => {
        expect(cjs.answer).toBe(42)
        expect(typeof module).toBe('undefined')
      })
    `,
  }, {
    injectCjsGlobals: false,
    server: { deps: { inline: [/raw-dep/] } },
  })
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})

test('referencing a cjs variable in an ES module fails with a hint', async () => {
  const { stderr, root, exitCode } = await runInlineTests({
    'basic.test.js': ts`
      import { test } from 'vitest'

      const dirname = __dirname

      test('not reported', () => {})
    `,
  }, { injectCjsGlobals: false })
  expect(exitCode).toBe(1)
  expect(replaceRoot(stderr, root)).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.js [ basic.test.js ]
    ReferenceError: __dirname is not defined

    "__dirname" is a CommonJS variable that is not available in ES modules, and "injectCjsGlobals" is disabled. If this module is meant to be an ES module, use "import.meta.dirname" instead of "__dirname". If it is meant to be a CommonJS module, use the ".cjs" file extension, set "type": "commonjs" in the nearest package.json, or externalize it with "server.deps.external".
     ❯ basic.test.js:4:23
          2|       import { test } from 'vitest'
          3|
          4|       const dirname = __dirname
           |                       ^
          5|
          6|       test('not reported', () => {})

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
})
