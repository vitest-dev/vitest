import type { RunVitestConfig } from '../../test-utils'
import { unlinkSync } from 'node:fs'
import { SourceMap } from 'node:module'
import { playwright } from '@vitest/browser-playwright'
import path from 'pathe'
import { expect, test } from 'vitest'
import { rolldownVersion } from 'vitest/node'
import { runInlineTests, runVitest, StableTestFileOrderSorter } from '../../test-utils'

test('setting resetMocks works if restoreMocks is also set', async () => {
  const { stderr, testTree } = await runInlineTests({
    'vitest.config.js': {
      test: {
        restoreMocks: true,
        mockReset: true,
      },
    },
    './mocked.js': `
export function spy() {}
    `,
    './basic.test.js': `
import { vi, test, expect } from 'vitest'
import { spy } from './mocked.js'

vi.mock('./mocked.js', { spy: true })

test('spy is called here', () => {
  spy()
  expect(spy).toHaveBeenCalled()
})

test('spy is not called here', () => {
  expect(spy).not.toHaveBeenCalled()
})
    `,
  })

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "spy is called here": "passed",
        "spy is not called here": "passed",
      },
    }
  `)
})

test('invalid packages', async () => {
  const { stderr, errorTree } = await runVitest({
    root: path.join(import.meta.dirname, '../fixtures/invalid-package'),
  })

  // requires Vite 8 for relaxed import analysis validation
  // https://github.com/vitejs/vite/pull/21601
  if (rolldownVersion) {
    expect(stderr).toMatchInlineSnapshot(`""`)
    expect(errorTree()).toMatchInlineSnapshot(`
      {
        "mock-bad-dep.test.ts": {
          "basic": "passed",
        },
        "mock-wrapper-and-bad-dep.test.ts": {
          "basic": "passed",
        },
        "mock-wrapper.test.ts": {
          "basic": "passed",
        },
      }
    `)
  }
  else {
    expect(errorTree()).toMatchInlineSnapshot(`
      {
        "mock-bad-dep.test.ts": {
          "__module_errors__": [
            "Failed to resolve entry for package "test-dep-invalid". The package may have incorrect main/module/exports specified in its package.json.",
          ],
        },
        "mock-wrapper-and-bad-dep.test.ts": {
          "__module_errors__": [
            "Failed to resolve entry for package "test-dep-invalid". The package may have incorrect main/module/exports specified in its package.json.",
          ],
        },
        "mock-wrapper.test.ts": {
          "basic": "passed",
        },
      }
    `)
  }
})

test('mocking modules with syntax error', async () => {
  const { errorTree } = await runInlineTests({
    './syntax-error.js': `syntax error`,
    './basic.test.js': /* ts */ `
import { test, expect, vi } from 'vitest'
import * as dep from './syntax-error.js'

vi.mock('./syntax-error.js', () => {
  return { mocked: 'ok' }
})

test('can mock invalid module', () => {
  expect(dep).toMatchObject({ mocked: 'ok' })
})
    `,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "can mock invalid module": "passed",
      },
    }
  `)
})

test('redirect mock with syntax error in original does not load original', async () => {
  const { errorTree, stderr } = await runInlineTests({
    './broken.js': `syntax error`,
    './__mocks__/broken.js': `export const value = 'mocked'`,
    './basic.test.js': `
import { test, expect, vi } from 'vitest'
import { value } from './broken.js'

vi.mock('./broken.js')

test('redirect mock works without loading broken original', () => {
  expect(value).toBe('mocked')
})
    `,
  })

  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "redirect mock works without loading broken original": "passed",
      },
    }
  `)
})

function modeToConfig(mode: string): RunVitestConfig {
  if (mode === 'playwright') {
    return {
      browser: {
        enabled: true,
        provider: playwright(),
        instances: [{ browser: 'chromium' }],
        headless: true,
      },
    }
  }
  return {}
}

test.for([
  ['node', 'hoisted'],
  ['node', 'mock'],
  ['jsdom', 'hoisted'],
  ['jsdom', 'mock'],
])('imported-value re-exports retain live bindings (%s, %s)', async ([environment, trigger]) => {
  const { stderr, thrown, errorTree } = await runInlineTests({
    'dependency.js': `
export let value = 1
export { value as default }
export const identity = {}
export function increment() { value++ }
export function read() { return value }
    `,
    'unused.js': 'export {}',
    'reexport.ts': `
import { vi } from 'vitest'
export { value, value as alias, importedDefault as default, importedDefault as namedDefault, namespace, identity, local, vi }
export { value as 'string name' }
import importedDefault, { value, identity, read } from './dependency.js'
import * as namespace from './dependency.js'
${trigger === 'hoisted' ? 'vi.hoisted(() => ({}))' : 'vi.mock(\'./unused.js\', () => ({}))'}
const local: number = 42
export function internal() { return read() }
    `,
    'explicit.js': `export { value } from './dependency.js'`,
    'basic.test.js': `
import { expect, test } from 'vitest'
import * as reexported from './reexport.ts'
import * as dependency from './dependency.js'
import * as explicit from './explicit.js'

test('live imported exports and unaffected paths', () => {
  expect(reexported.local).toBe(42)
  expect(reexported.vi.hoisted).toBeTypeOf('function')
  expect(reexported.internal()).toBe(1)
  expect(explicit.value).toBe(1)

  expect.soft(reexported.value).toBe(1)
  expect.soft(reexported.alias).toBe(1)
  expect.soft(reexported['string name']).toBe(1)
  expect.soft(reexported.default).toBe(1)
  expect.soft(reexported.namedDefault).toBe(1)
  expect.soft(reexported.identity).toBe(dependency.identity)
  expect.soft(reexported.namespace).toBe(dependency)

  dependency.increment()
  expect(reexported.internal()).toBe(2)
  expect(explicit.value).toBe(2)
  expect.soft(reexported.value).toBe(2)
  expect.soft(reexported.alias).toBe(2)
  expect.soft(reexported['string name']).toBe(2)
  expect.soft(reexported.default).toBe(2)
  expect.soft(reexported.namedDefault).toBe(2)
})
    `,
  }, { environment })

  expect(thrown).toBe(false)
  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "live imported exports and unaffected paths": "passed",
      },
    }
  `)
})

test('imported-value re-exports use the same live mock as internal imports', async () => {
  const { stderr, testTree } = await runInlineTests({
    'dependency.js': `throw new Error('the original must not evaluate')`,
    'reexport.js': `
import { vi } from 'vitest'
import { value, identity } from './dependency.js'
import * as namespace from './dependency.js'
const state = vi.hoisted(() => ({ value: 1, events: ['hoisted'] }))
vi.mock('./dependency.js', () => {
  state.events.push('factory')
  return { get value() { return state.value }, identity: {} }
})
export { value, identity, namespace }
export function internal() { return { value, identity, namespace } }
export function increment() { state.value++ }
export const events = state.events
    `,
    'basic.test.js': `
import { expect, test } from 'vitest'
import * as exported from './reexport.js'
test('order, identity and live mock updates', () => {
  expect(exported.events).toEqual(['hoisted', 'factory'])
  expect(exported.value).toBe(1)
  expect(exported.identity).toBe(exported.internal().identity)
  expect(exported.namespace).toBe(exported.internal().namespace)
  exported.increment()
  expect(exported.value).toBe(2)
  expect(exported.value).toBe(exported.internal().value)
})
    `,
  })
  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "order, identity and live mock updates": "passed",
      },
    }
  `)
})

test.for(['dynamic', 'static'])('imported-value re-exports register getters before circular imports (%s)', async (kind) => {
  let transforms = 0
  const config = (): RunVitestConfig => ({
    fsModuleCache: true,
    $viteConfig: {
      plugins: [{
        name: 'count-reexport-transforms',
        transform(_code, id) {
          if (id.endsWith('/reexport.js')) {
            transforms++
          }
        },
      }],
    },
  })
  const run = await runInlineTests({
    'dependency.js': `
import * as exported from './reexport.js'
export const before = { registered: Object.hasOwn(exported, 'value'), value: exported.value }
export const value = 1
    `,
    'reexport.js': `
import { vi } from 'vitest'
import { value${kind === 'dynamic' ? ', before' : ''} } from './dependency.js'
vi.hoisted(() => ({}))
export { value${kind === 'dynamic' ? ', before' : ''} }
${kind === 'static' ? 'export { before } from \'./dependency.js\'' : ''}
export function read() { return value }
    `,
    'basic.test.js': `
import { expect, test } from 'vitest'
import { value, before } from './reexport.js'
test('registered before imports, undefined during TDZ, live after initialization', () => {
  expect(before).toEqual({ registered: true, value: undefined })
  expect(value).toBe(1)
})
    `,
  }, config())
  expect(run.stderr).toBe('')
  expect(run.testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "registered before imports, undefined during TDZ, live after initialization": "passed",
      },
    }
  `)
  const project = run.ctx!.projects[0]
  const environment = project.vite.environments.ssr
  const node = environment.moduleGraph.getModuleById(path.join(run.root, 'reexport.js'))!
  const result = node.transformResult!
  const line = result.code.slice(0, result.code.indexOf('function read')).split('\n').length
  const map = new SourceMap(JSON.parse(JSON.stringify(result.map)))
  expect(map.findOrigin(line, 1).lineNumber).toBe(7)
  expect(transforms).toBe(1)

  environment.moduleGraph.invalidateModule(node)
  const restored = await project._fetcher(node.url, undefined, environment)
  expect(restored).toHaveProperty('cached', true)
  if (!('tmp' in restored)) {
    throw new Error('Expected the restored module to be cached')
  }
  unlinkSync(restored.tmp)
  await project._fetcher(node.url, undefined, environment)
  expect(node.transformResult!.code.match(/__vite_ssr_exportName__\("value",/g)).toHaveLength(1)

  await run.ctx!.close()
  const warm = await runVitest({ ...config(), root: run.root })
  expect(warm.stderr).toBe('')
  expect(warm.testTree()).toEqual(run.testTree())
  expect(transforms).toBe(1)
})

test.for(['node', 'playwright'])('importOriginal for virtual modules (%s)', async (mode) => {
  const { stderr, errorTree } = await runInlineTests({
    'vitest.config.js': `
import { defineConfig } from 'vitest/config'
export default defineConfig({
  plugins: [{
    name: 'virtual-test',
    resolveId(source) {
      if (source === 'virtual:my-module') {
        return "\\0" + source
      }
    },
    load(id) {
      if (id === '\\0virtual:my-module') {
        return 'export const value = "original"'
      }
    },
  }],
})
    `,
    './basic.test.js': `
import { test, expect, vi } from 'vitest'
import { value } from 'virtual:my-module'

vi.mock('virtual:my-module', async (importOriginal) => {
  const original = await importOriginal()
  return { value: original.value + '-modified' }
})

test('importOriginal returns original virtual module exports', () => {
  expect(value).toBe('original-modified')
})
    `,
  }, modeToConfig(mode))

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "importOriginal returns original virtual module exports": "passed",
      },
    }
  `)
})

test.for(['node', 'playwright'])('mocking virtual module without importOriginal skips loading original (%s)', async (mode) => {
  const { stderr, testTree } = await runInlineTests({
    'vitest.config.js': `
import { defineConfig } from 'vitest/config'
export default defineConfig({
  plugins: [{
    name: 'virtual-test',
    resolveId(source) {
      if (source === 'virtual:my-module') {
        return "\\0" + source
      }
    },
    load(id) {
      if (id === '\\0virtual:my-module') {
        throw new Error('virtual module load should not be called')
      }
    },
  }],
})
    `,
    './basic.test.js': `
import { test, expect, vi } from 'vitest'
import { value } from 'virtual:my-module'

vi.mock('virtual:my-module', () => {
  return { value: 'mocked' }
})

test('mock works without loading original', () => {
  expect(value).toBe('mocked')
})
    `,
  }, modeToConfig(mode))

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "mock works without loading original": "passed",
      },
    }
  `)
})

test.for(['node', 'playwright'])('mocking actual module with factory skips loading original (%s)', async (mode) => {
  const { stderr, errorTree } = await runInlineTests({
    'vitest.config.js': `
import { defineConfig } from 'vitest/config'
export default defineConfig({
  plugins: [{
    name: 'guard-load',
    transform(code, id) {
      if (id.includes('do-not-load')) {
        throw new Error('original module should not be transformed')
      }
    },
  }],
})
    `,
    './do-not-load.js': `export const value = 'original'`,
    './basic.test.js': `
import { test, expect, vi } from 'vitest'
import * as dep from './do-not-load.js'

vi.mock('./do-not-load.js', () => {
  return { value: 'mocked' }
})

test('mock works without loading original', () => {
  expect(dep).toMatchObject({ value: 'mocked' })
})
    `,
  }, modeToConfig(mode))

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "mock works without loading original": "passed",
      },
    }
  `)
})

test.for(['node', 'playwright'])('mocking actual module via __mocks__ skips loading original (%s)', async (mode) => {
  const { stderr, errorTree } = await runInlineTests({
    'vitest.config.js': `
import { defineConfig } from 'vitest/config'
export default defineConfig({
  plugins: [{
    name: 'guard-load',
    transform(code, id) {
      if (id.includes('do-not-load') && !id.includes('__mocks__')) {
        throw new Error('original module should not be transformed')
      }
    },
  }],
})
    `,
    './do-not-load.js': `export const value = 'original'`,
    './__mocks__/do-not-load.js': `export const value = 'mocked'`,
    './basic.test.js': `
import { test, expect, vi } from 'vitest'
import { value } from './do-not-load.js'

vi.mock('./do-not-load.js')

test('mock works without loading original', () => {
  expect(value).toBe('mocked')
})
    `,
  }, modeToConfig(mode))

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "mock works without loading original": "passed",
      },
    }
  `)
})

test('doMock/doUnmock ordering is preserved in resolveMocks', async () => {
  // This tests repeats doUnmock + doMock
  //   vi.doUnmock('/mock-lib-0');
  //   vi.doMock('/mock-lib-0', () => ({ value: 0 }));
  //   vi.doUnmock('/mock-lib-1');
  //   vi.doMock('/mock-lib-1', () => ({ value: 1 }));
  //   ...
  // then, all modules should be mocked
  //   import('/mock-lib-0') // => { value: 0 }
  //   import('/mock-lib-1') // => { value: 1 }
  //   ...
  const N = 20
  const mockEntries = Array.from({ length: N }, (_, i) => `\
vi.doUnmock('/mock-lib-${i}');
vi.doMock('/mock-lib-${i}', () => ({ value: ${i} }));
`).join('\n')
  const importChecks = Array.from({ length: N }, (_, i) => `\
await expect(import('/mock-lib-${i}')).resolves.toEqual({ value: ${i} });
`).join('\n')

  const { stderr, errorTree } = await runInlineTests({
    './basic.test.js': `
import { test, expect, vi } from 'vitest'

test('many unmock + mock (all should mocked)', async () => {
${mockEntries}
${importChecks}
})
    `,
  })

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "many unmock + mock (all should mocked)": "passed",
      },
    }
  `)
})

test.for([
  'node',
  'playwright',
])('repeating mock, importActual, and resetModules (%s)', async (mode) => {
  const { stderr, errorTree } = await runInlineTests({
    // external
    './external.test.ts': `
import { expect, test, vi } from "vitest"

test("external", async () => {
  vi.doMock(import("test-dep-simple"), async (importActual) => {
    const lib = await importActual();
    return lib;
  })
  const lib1: any = await import("test-dep-simple")
  expect(lib1.default).toBe("test-dep-simple")

  vi.resetModules();
  vi.doMock(import("test-dep-simple"), async (importActual) => {
    const lib = await importActual();
    return lib;
  })
  const lib2: any = await import("test-dep-simple")
  expect(lib2.default).toBe("test-dep-simple")
  expect.soft(lib1 !== lib2).toBe(true)

  vi.resetModules();
  vi.doMock(import("test-dep-simple"), async () => ({ mocked: true }));
  const lib3 = await import("test-dep-simple");
  expect(lib3).toMatchObject({ mocked: true })

  const lib4 = await vi.importActual("test-dep-simple");
  expect(lib4.default).toBe("test-dep-simple")
  const lib5 = await vi.importActual("test-dep-simple");
  expect(lib4).toBe(lib5)
});
    `,
    // builtin module
    './builtin.test.ts': `
import { expect, test, vi } from "vitest"

test("builtin", async () => {
  vi.doMock(import("node:path"), async (importActual) => {
    const lib = await importActual();
    return lib;
  })
  const lib1: any = await import("node:path")
  expect(lib1).toHaveProperty('join')

  vi.resetModules();
  vi.doMock(import("node:path"), async (importActual) => {
    const lib = await importActual();
    return lib;
  })
  const lib2: any = await import("node:path")
  expect(lib2).toHaveProperty('join')
  expect.soft(lib1 !== lib2).toBe(true)

  vi.resetModules();
  vi.doMock(import("node:path"), async () => ({ mocked: true }));
  const lib3 = await import("node:path");
  expect(lib3).toMatchObject({ mocked: true })

  const lib4 = await vi.importActual("node:path");
  expect(lib4).toHaveProperty('join')
  const lib5 = await vi.importActual("node:path");
  expect(lib4).toBe(lib5)
});
    `,
    // local module
    './local.test.ts': `
import { expect, test, vi } from "vitest"

test("local", async () => {
  vi.doMock(import("./local.js"), async (importActual) => {
    const lib = await importActual();
    return lib;
  })
  const lib1: any = await import("./local.js")
  expect(lib1).toHaveProperty('local')

  vi.resetModules();
  vi.doMock(import("./local.js"), async (importActual) => {
    const lib = await importActual();
    return lib;
  })
  const lib2: any = await import("./local.js")
  expect(lib2).toHaveProperty('local')
  expect.soft(lib1 !== lib2).toBe(true)

  vi.resetModules();
  vi.doMock(import("./local.js"), async () => ({ mocked: true }));
  const lib3 = await import("./local.js");
  expect(lib3).toMatchObject({ mocked: true })

  const lib4 = await vi.importActual("./local.js");
  expect(lib4).toHaveProperty('local')
  const lib5 = await vi.importActual("./local.js");
  expect(lib4).toBe(lib5)
});
    `,
    './local.js': `export const local = 'local'`,
  }, modeToConfig(mode))

  if (mode === 'playwright') {
    // browser mode doesn't support resetModules nor node builtin
    expect(errorTree()).toMatchInlineSnapshot(`
      {
        "builtin.test.ts": {
          "builtin": [
            "Cannot convert a Symbol value to a string",
          ],
        },
        "external.test.ts": {
          "external": [
            "expected false to be true // Object.is equality",
            "expected { default: 'test-dep-simple', …(1) } to match object { mocked: true }
      (1 matching property omitted from actual)",
          ],
        },
        "local.test.ts": {
          "local": [
            "expected false to be true // Object.is equality",
            "expected { local: 'local', …(1) } to match object { mocked: true }
      (1 matching property omitted from actual)",
          ],
        },
      }
    `)
    return
  }

  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "builtin.test.ts": {
        "builtin": "passed",
      },
      "external.test.ts": {
        "external": "passed",
      },
      "local.test.ts": {
        "local": "passed",
      },
    }
  `)
})

test('automocking works with isolate:false when factory mock runs first (resolve alias)', async () => {
  const { stderr, testTree } = await runInlineTests({
    'vitest.config.js': `
import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '~': path.resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    isolate: false,
  },
})
    `,
    './src/dep.ts': `
export function useDep(): string { return 'real' }
export function helperDep(): number { return 42 }
    `,
    './a-factory.test.ts': `
import { vi, test, expect } from 'vitest'
import { useDep } from '~/dep'
vi.mock(import('~/dep'), () => ({
  useDep: () => 'factory',
  helperDep: () => 0,
}))
test('factory mock', () => {
  expect(useDep()).toBe('factory')
})
    `,
    './b-automock.test.ts': `
import { vi, test, expect } from 'vitest'
import { useDep } from '~/dep'
vi.mock(import('~/dep'))
test('automock exports are mock functions', () => {
  expect(vi.isMockFunction(useDep)).toBe(true)
})
test('automock mockReturnValue works', () => {
  vi.mocked(useDep).mockReturnValue('mocked')
  expect(useDep()).toBe('mocked')
})
    `,
  }, {
    sequence: { sequencer: StableTestFileOrderSorter },
  })

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "a-factory.test.ts": {
        "factory mock": "passed",
      },
      "b-automock.test.ts": {
        "automock exports are mock functions": "passed",
        "automock mockReturnValue works": "passed",
      },
    }
  `)
})
