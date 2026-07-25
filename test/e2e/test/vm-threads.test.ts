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

// vm pools resolve `isolate` to false (isolation comes from a fresh VM
// context per run request), which used to trigger the "single non-isolated
// worker receives all files at once" batching with `maxWorkers: 1` — all
// files then shared one VM context and leaked state into each other
test.for(['vmThreads', 'vmForks'] as const)(
  '%s keeps per-file isolation when maxWorkers is 1',
  async (pool) => {
    // each file both expects a clean context and pollutes it, so the test
    // does not depend on the file execution order
    const pollutingTest = `
      import { expect, test } from 'vitest'

      test('does not see state from other test files', () => {
        expect(globalThis.__isolation_leak__).toBeUndefined()
        globalThis.__isolation_leak__ = import.meta.url
      })
    `
    const { stderr, exitCode } = await runInlineTests({
      'a.test.js': pollutingTest,
      'b.test.js': pollutingTest,
    }, {
      pool,
      maxWorkers: 1,
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
// On Node 24.9+ the vm pools support require(esm), so the condition resolves
// to the ESM entry there — matching Node's own require() behaviour.
const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number)
const supportsRequireEsm = nodeMajor > 24 || (nodeMajor === 24 && nodeMinor >= 9)
const moduleSyncEntry = supportsRequireEsm ? 'esm' : 'cjs'
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

      test('require loads the right entry for module-sync package (.mjs)', () => {
        const mod = require('module-sync-mjs')
        expect(mod.value).toBe('${moduleSyncEntry}')
      })

      test('require loads the right entry for module-sync package (.js with type: module)', () => {
        const mod = require('module-sync-js')
        expect(mod.value).toBe('${moduleSyncEntry}')
      })
    `,
  }, {
    pool: 'vmThreads',
  })

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})

// https://nodejs.org/api/esm.html#commonjs-namespaces
test.for(['vmThreads', 'vmForks'] as const)(
  '%s provides the "module.exports" export on CommonJS namespaces',
  async (pool) => {
    const { stderr, exitCode } = await runVitest({
      root: './fixtures/vm-cjs-namespace',
      pool,
    })

    expect(stderr).toBe('')
    expect(exitCode).toBe(0)
  },
)

// require(esm) needs the synchronous module graph APIs added in Node 24.9
// (SourceTextModule#hasAsyncGraph/linkRequests/instantiate)
test.skipIf(!supportsRequireEsm).for(['vmThreads', 'vmForks'] as const)(
  '%s supports require() of ES modules on Node 24.9+',
  async (pool) => {
    const { stderr, exitCode } = await runInlineTests({
      'package.json': '{}',
      'esm-scope/package.json': JSON.stringify({ type: 'module' }),
      'esm-scope/dep.mjs': 'export const dep = "dep"',
      'esm-scope/dep.cjs': 'module.exports = { fromCjs: "cjs" }',
      'esm-scope/entry.mjs': [
        'import { sep } from "node:path"',
        'import { dep } from "./dep.mjs"',
        'import cjs from "./dep.cjs"',
        'export const value = ["entry", dep, cjs.fromCjs].join(":")',
        'export const hasBuiltin = typeof sep === "string"',
        'export default "default-export"',
      ].join('\n'),
      'esm-scope/scoped.js': 'export const value = "js-in-esm-scope"',
      'esm-scope/tla.mjs': 'export const value = await Promise.resolve("tla")',
      'esm-scope/tla-dep.mjs': [
        'import { value } from "./tla.mjs"',
        'export const wrapped = value',
      ].join('\n'),
      'esm-scope/module-exports.mjs': [
        'const answer = 42',
        'export { answer as "module.exports" }',
      ].join('\n'),
      'esm-scope/cjs-wrapper.mjs': 'export * from "./dep.cjs"',
      'esm-scope/cycle-a.mjs': [
        'import { b } from "./cycle-b.mjs"',
        'export const a = "a"',
        'export const seenB = b',
      ].join('\n'),
      'esm-scope/cycle-b.mjs': [
        'import { a } from "./cycle-a.mjs"',
        'export const b = "b"',
        'export function readA() { return a }',
      ].join('\n'),
      'esm-scope/data.json': '{"answer": 42}',
      'esm-scope/imports-json.mjs': [
        'import data from "./data.json" with { type: "json" }',
        'export const answer = data.answer',
      ].join('\n'),
      'cjs-scope/package.json': '{}',
      'cjs-scope/esm-syntax.js': 'export const value = "detected"',
      'node_modules/esm-pkg/package.json': JSON.stringify({
        name: 'esm-pkg',
        exports: './index.mjs',
      }),
      'node_modules/esm-pkg/index.mjs': 'export const state = { name: "esm-pkg" }',
      'node_modules/esm-pkg-2/package.json': JSON.stringify({
        name: 'esm-pkg-2',
        exports: './index.mjs',
      }),
      'node_modules/esm-pkg-2/index.mjs': 'export const state = { name: "esm-pkg-2" }',
      'require-esm.test.js': `
        import { createRequire } from 'node:module'
        import { expect, test } from 'vitest'

        const require = createRequire(import.meta.url)

        test('loads an ES module graph with esm, cjs and builtin dependencies', () => {
          const ns = require('./esm-scope/entry.mjs')
          expect(ns.value).toBe('entry:dep:cjs')
          expect(ns.hasBuiltin).toBe(true)
          expect(ns.default).toBe('default-export')
        })

        test('require() of the same module is cached', () => {
          expect(require('./esm-scope/entry.mjs')).toBe(require('./esm-scope/entry.mjs'))
        })

        test('loads a .js file from a "type": "module" scope', () => {
          expect(require('./esm-scope/scoped.js').value).toBe('js-in-esm-scope')
        })

        test('supports circular imports', () => {
          const ns = require('./esm-scope/cycle-a.mjs')
          expect(ns.a).toBe('a')
          expect(ns.seenB).toBe('b')
        })

        test('an export named "module.exports" defines the require() result', () => {
          expect(require('./esm-scope/module-exports.mjs')).toBe(42)
        })

        test('export * from a cjs file carries "module.exports" through require()', () => {
          // the cjs namespace exposes its raw exports as a "module.exports"
          // named export, which export * re-exports (unlike default) - so
          // requiring the ESM wrapper returns the raw cjs exports object
          expect(require('./esm-scope/cjs-wrapper.mjs')).toBe(require('./esm-scope/dep.cjs'))
        })

        test('require() of json keeps returning the plain object', () => {
          expect(require('./esm-scope/data.json')).toEqual({ answer: 42 })
        })

        test('static json imports work inside a required ES module', () => {
          expect(require('./esm-scope/imports-json.mjs').answer).toBe(42)
        })

        test('top-level await throws ERR_REQUIRE_ASYNC_MODULE', () => {
          let error
          try {
            require('./esm-scope/tla.mjs')
          }
          catch (caught) {
            error = caught
          }
          expect(error).toBeDefined()
          expect(error.code).toBe('ERR_REQUIRE_ASYNC_MODULE')
          expect(error.message).toContain('top-level await')
        })

        test('top-level await in a dependency throws ERR_REQUIRE_ASYNC_MODULE', () => {
          let error
          try {
            require('./esm-scope/tla-dep.mjs')
          }
          catch (caught) {
            error = caught
          }
          expect(error).toBeDefined()
          expect(error.code).toBe('ERR_REQUIRE_ASYNC_MODULE')
        })

        test('falls back to ESM for a .js file with ESM syntax in a CJS scope', () => {
          const ns = require('./cjs-scope/esm-syntax.js')
          expect(ns.value).toBe('detected')
          expect(require('./cjs-scope/esm-syntax.js')).toBe(ns)
        })

        test('import() after require() reuses the same module', async () => {
          const required = require('esm-pkg')
          const imported = await import('esm-pkg')
          expect(imported.state).toBe(required.state)
        })

        test('require() after import() reuses the same module', async () => {
          const imported = await import('esm-pkg-2')
          const required = require('esm-pkg-2')
          expect(required.state).toBe(imported.state)
        })
      `,
    }, {
      pool,
    })

    expect(stderr).toBe('')
    expect(exitCode).toBe(0)
  },
)

// error handling, cache interplay with import(), and edges that cannot be
// loaded synchronously. esm-scope/cjs-scope are externalized so that both
// require() and import() of the same files go through the vm executors.
test.skipIf(!supportsRequireEsm).for(['vmThreads', 'vmForks'] as const)(
  '%s handles require(esm) edge cases',
  async (pool) => {
    const { stderr, exitCode } = await runInlineTests({
      'package.json': '{}',
      'esm-scope/package.json': JSON.stringify({ type: 'module' }),
      'esm-scope/throws.mjs': 'throw new Error("boom")',
      'esm-scope/tla.mjs': 'export const value = await Promise.resolve("tla")',
      'esm-scope/tla-imported.mjs': 'export const done = await Promise.resolve(true)',
      'esm-scope/shared.mjs': 'export const state = { name: "shared" }',
      'esm-scope/uses-shared.mjs': 'export { state } from "./shared.mjs"',
      'esm-scope/dynamic.mjs': 'export function load() { return import("./shared.mjs") }',
      'esm-scope/meta.mjs': [
        'export const url = import.meta.url',
        'export const filename = import.meta.filename',
        'export const resolved = import.meta.resolve("./shared.mjs")',
      ].join('\n'),
      'esm-scope/imports-data.mjs': [
        'import { fromData } from "data:text/javascript,export%20const%20fromData%20=%20%22data-js%22"',
        'import json from "data:application/json,%7B%22a%22:1%7D" with { type: "json" }',
        'export const combined = fromData + ":" + json.a',
      ].join('\n'),
      'esm-scope/imports-data-wasm.mjs': 'import "data:application/wasm;base64,AGFzbQEAAAA="',
      'esm-scope/imports-wasm.mjs': 'import "./empty.wasm"',
      'esm-scope/empty.wasm': '',
      'esm-scope/imports-css.mjs': 'import "./style.css"\nexport const x = 1',
      'esm-scope/style.css': 'body {}',
      'esm-scope/imports-missing.mjs': 'import { x } from "./missing.mjs"\nexport const y = x',
      'esm-scope/plain-cjs.js': 'module.exports = { value: "stays-cjs" }',
      'esm-scope/leaf.mjs': 'export const leaf = "leaf"',
      'esm-scope/bridge.cjs': 'module.exports = require("./leaf.mjs")',
      'esm-scope/host.mjs': [
        'import bridge from "./bridge.cjs"',
        'export const value = bridge.leaf',
      ].join('\n'),
      'cjs-scope/package.json': '{}',
      'cjs-scope/broken.js': 'const x = {',
      'cjs-scope/esm-tla.js': 'export const x = await Promise.resolve(1)',
      'cjs-scope/wrong.cjs': 'export const x = 1',
      'cjs-scope/esm-syntax.js': 'export const value = "detected"',
      'require-esm-edge.test.js': `
        import { createRequire } from 'node:module'
        import { expect, test } from 'vitest'

        const require = createRequire(import.meta.url)

        function requireError(id) {
          try {
            require(id)
          }
          catch (error) {
            return error
          }
          throw new Error('expected require to throw for ' + id)
        }

        test('an evaluation error is thrown and cached', async () => {
          expect(() => require('./esm-scope/throws.mjs')).toThrow('boom')
          // second require rethrows from the errored cache entry
          expect(() => require('./esm-scope/throws.mjs')).toThrow('boom')
          // import() shares the same errored module
          await expect(import('./esm-scope/throws.mjs')).rejects.toThrow('boom')
        })

        test('require() of a TLA module already evaluated by import() still throws', async () => {
          const ns = await import('./esm-scope/tla-imported.mjs')
          expect(ns.done).toBe(true)
          // a settled async graph is still not require()-able (Node parity)
          const error = requireError('./esm-scope/tla-imported.mjs')
          expect(error.code).toBe('ERR_REQUIRE_ASYNC_MODULE')
        })

        test('a failed require() does not poison the import() cache', async () => {
          expect(requireError('./esm-scope/tla.mjs').code).toBe('ERR_REQUIRE_ASYNC_MODULE')
          const ns = await import('./esm-scope/tla.mjs')
          expect(ns.value).toBe('tla')
        })

        test('require() reuses modules already evaluated by import()', async () => {
          const imported = await import('./esm-scope/shared.mjs')
          const required = require('./esm-scope/uses-shared.mjs')
          expect(required.state).toBe(imported.state)
        })

        test('data: javascript and json dependencies load synchronously', () => {
          expect(require('./esm-scope/imports-data.mjs').combined).toBe('data-js:1')
        })

        test('data: wasm dependencies throw ERR_REQUIRE_ASYNC_MODULE', () => {
          const error = requireError('./esm-scope/imports-data-wasm.mjs')
          expect(error.code).toBe('ERR_REQUIRE_ASYNC_MODULE')
          expect(error.message).toContain('WebAssembly')
        })

        test('wasm file dependencies throw ERR_REQUIRE_ASYNC_MODULE', () => {
          const error = requireError('./esm-scope/imports-wasm.mjs')
          expect(error.code).toBe('ERR_REQUIRE_ASYNC_MODULE')
          expect(error.message).toContain('WebAssembly')
        })

        test('vite-transformed dependencies throw ERR_REQUIRE_ASYNC_MODULE', () => {
          const error = requireError('./esm-scope/imports-css.mjs')
          expect(error.code).toBe('ERR_REQUIRE_ASYNC_MODULE')
          expect(error.message).toContain('Vite')
        })

        test('a missing dependency throws ERR_MODULE_NOT_FOUND', () => {
          const error = requireError('./esm-scope/imports-missing.mjs')
          expect(error.code).toBe('ERR_MODULE_NOT_FOUND')
        })

        test('a .js file without ESM syntax keeps loading as CJS in an ESM scope', () => {
          const exports = require('./esm-scope/plain-cjs.js')
          expect(exports.value).toBe('stays-cjs')
          expect('default' in exports).toBe(false)
        })

        test('a CJS dependency can require() ES modules during the graph walk', () => {
          expect(require('./esm-scope/host.mjs').value).toBe('leaf')
        })

        test('import.meta is populated inside required ES modules', () => {
          const ns = require('./esm-scope/meta.mjs')
          expect(ns.url.startsWith('file://')).toBe(true)
          expect(ns.url.endsWith('meta.mjs')).toBe(true)
          expect(ns.filename.endsWith('meta.mjs')).toBe(true)
          expect(ns.resolved.endsWith('shared.mjs')).toBe(true)
        })

        test('dynamic import() works inside a required ES module', async () => {
          const ns = require('./esm-scope/dynamic.mjs')
          const dep = await ns.load()
          const imported = await import('./esm-scope/shared.mjs')
          expect(dep.state).toBe(imported.state)
        })

        test('a syntax error in a CJS-scope .js file surfaces the original error', () => {
          const error = requireError('./cjs-scope/broken.js')
          expect(error.name).toBe('SyntaxError')
          expect(error.code).toBeUndefined()
        })

        test('the ESM-syntax fallback surfaces non-syntax ESM errors', () => {
          const error = requireError('./cjs-scope/esm-tla.js')
          expect(error.code).toBe('ERR_REQUIRE_ASYNC_MODULE')
        })

        test('.cjs files never fall back to ESM', () => {
          const error = requireError('./cjs-scope/wrong.cjs')
          expect(error.name).toBe('SyntaxError')
          expect(error.code).toBeUndefined()
        })

        test('import() of a CJS-scope .js file with ESM syntax works', async () => {
          const ns = await import('./cjs-scope/esm-syntax.js')
          expect(ns.value).toBe('detected')
        })
      `,
    }, {
      pool,
      server: {
        deps: {
          external: [/esm-scope/, /cjs-scope/],
        },
      },
    })

    expect(stderr).toBe('')
    expect(exitCode).toBe(0)
  },
)
