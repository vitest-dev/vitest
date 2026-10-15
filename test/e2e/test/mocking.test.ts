import type { RunVitestConfig } from '../../test-utils'
import path from 'node:path'
import { playwright } from '@vitest/browser-playwright'
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

test('mockReset works with autospied Node modules', async () => {
  const { stderr, testTree } = await runInlineTests({
    'vitest.config.js': {
      test: {
        mockReset: true,
      },
    },
    './basic.test.js': `
import * as fsp from 'node:fs/promises'
import { expect, test, vi } from 'vitest'

vi.mock(import('node:fs/promises'), { spy: true })

test('exposes the spied module', () => {
  expect(fsp.readFile).toBeDefined()
})
    `,
  })

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "exposes the spied module": "passed",
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
  } else {
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

test.for(['node', 'playwright'])('importOriginal for virtual modules (%s)', async (mode) => {
  const { stderr, errorTree } = await runInlineTests(
    {
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
    },
    modeToConfig(mode),
  )

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "importOriginal returns original virtual module exports": "passed",
      },
    }
  `)
})

test.for(['node', 'playwright'])(
  'mocking virtual module without importOriginal skips loading original (%s)',
  async (mode) => {
    const { stderr, testTree } = await runInlineTests(
      {
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
      },
      modeToConfig(mode),
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "mock works without loading original": "passed",
      },
    }
  `)
  },
)

test.for(['node', 'playwright'])(
  'mocking actual module with factory skips loading original (%s)',
  async (mode) => {
    const { stderr, errorTree } = await runInlineTests(
      {
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
      },
      modeToConfig(mode),
    )

    expect(stderr).toBe('')
    expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "mock works without loading original": "passed",
      },
    }
  `)
  },
)

test.for(['node', 'playwright'])(
  'mocking actual module via __mocks__ skips loading original (%s)',
  async (mode) => {
    const { stderr, errorTree } = await runInlineTests(
      {
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
      },
      modeToConfig(mode),
    )

    expect(stderr).toBe('')
    expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "mock works without loading original": "passed",
      },
    }
  `)
  },
)

// https://github.com/vitest-dev/vitest/issues/8653
test.for(['node', 'playwright'])(
  'in-source vi.mock applies only when its file is the test file (%s)',
  async (mode) => {
    const { stderr, errorTree } = await runInlineTests(
      {
        './src/name.js': `export const getName = () => 'original'`,
        './src/b.js': `
import { getName } from './name.js'
export const greet = () => 'hello, ' + getName()

if (import.meta.vitest) {
  const { test, expect, vi } = import.meta.vitest
  const mocks = vi.hoisted(() => ({ getName: vi.fn(() => 'b') }))
  vi.mock('./name.js', () => mocks)
  test('b mocks name.js', () => {
    expect(greet()).toBe('hello, b')
    expect(mocks.getName).toHaveBeenCalledOnce()
  })
}
    `,
        './src/a.js': `
import { greet } from './b.js'

if (import.meta.vitest) {
  const { test, expect, vi } = import.meta.vitest
  vi.mock('./name.js', () => ({ getName: () => 'a' }))
  test('imported b does not mock name.js', () => {
    expect(greet()).toBe('hello, a')
  })
}
    `,
      },
      { ...modeToConfig(mode), includeSource: ['src/*.js'] },
    )

    expect(stderr).toBe('')
    expect(errorTree()).toMatchInlineSnapshot(`
      {
        "src/a.js": {
          "imported b does not mock name.js": "passed",
        },
        "src/b.js": {
          "b mocks name.js": "passed",
        },
      }
    `)
  },
)

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
  const mockEntries = Array.from(
    { length: N },
    (_, i) => `\
vi.doUnmock('/mock-lib-${i}');
vi.doMock('/mock-lib-${i}', () => ({ value: ${i} }));
`,
  ).join('\n')
  const importChecks = Array.from(
    { length: N },
    (_, i) => `\
await expect(import('/mock-lib-${i}')).resolves.toEqual({ value: ${i} });
`,
  ).join('\n')

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

test('the last doMock of the same path wins', async () => {
  // repeats doMock twice for the same path without an import in between
  //   vi.doMock('/mock-lib-0', () => ({ value: 'first' }));
  //   vi.doMock('/mock-lib-0', () => ({ value: 'second' }));
  //   ...
  // then, the last registered factory should be used
  //   import('/mock-lib-0') // => { value: 'second' }
  const N = 20
  const mockEntries = Array.from(
    { length: N },
    (_, i) => `\
vi.doMock('/mock-lib-${i}', () => ({ value: 'first' }));
vi.doMock('/mock-lib-${i}', () => ({ value: 'second' }));
`,
  ).join('\n')
  const importChecks = Array.from(
    { length: N },
    (_, i) => `\
await expect(import('/mock-lib-${i}')).resolves.toEqual({ value: 'second' });
`,
  ).join('\n')

  const { stderr, errorTree } = await runInlineTests({
    './basic.test.js': `
import { test, expect, vi } from 'vitest'

test('duplicate mock of the same path (last one should win)', async () => {
${mockEntries}
${importChecks}
})
    `,
  })

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "duplicate mock of the same path (last one should win)": "passed",
      },
    }
  `)
})

test.for(['node', 'playwright'])(
  'repeating mock, importActual, and resetModules (%s)',
  async (mode) => {
    const { stderr, errorTree } = await runInlineTests(
      {
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
      },
      modeToConfig(mode),
    )

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
  },
)

test('automocking works with isolate:false when factory mock runs first (resolve alias)', async () => {
  const { stderr, testTree } = await runInlineTests(
    {
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
    },
    {
      sequence: { sequencer: StableTestFileOrderSorter },
    },
  )

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

function trackScope(name: string) {
  return `
const scope = vi.hoisted(() => {
  const scope = { name: '${name}' }
  globalThis.scopes = [...(globalThis.scopes ?? []), new WeakRef(scope)]
  return scope
})`
}

test.for(['threads', 'forks'])(
  'isolate:false releases mocks of finished files (%s)',
  async (pool) => {
    const { stderr, errorTree } = await runInlineTests(
      {
        './dep-a.ts': `export const dep = () => 'real'`,
        './dep-b.ts': `export const dep = () => 'real'`,
        './dep-c.ts': `export const dep = () => 'real'`,
        './dep-d.ts': `export const dep = () => 'real'`,
        './dep-e.ts': `export const dep = () => 'real'`,
        './dep-f.ts': `export const dep = () => 'real'`,
        './a-factory.test.ts': `
import { expect, test, vi } from 'vitest'
import { dep } from './dep-a'
${trackScope('vi.mock factory')}
vi.mock('./dep-a', () => ({ dep: () => scope.name }))
test('mocked', () => {
  expect(dep()).toBe('vi.mock factory')
})
    `,
        './b-automock.test.ts': `
import { expect, test, vi } from 'vitest'
import { dep } from './dep-b'
${trackScope('automock')}
vi.mock('./dep-b')
test('mocked', () => {
  vi.mocked(dep).mockImplementation(() => scope.name)
  expect(dep()).toBe('automock')
})
    `,
        './c-autospy.test.ts': `
import { expect, test, vi } from 'vitest'
import { dep } from './dep-c'
${trackScope('autospy')}
vi.mock('./dep-c', { spy: true })
test('mocked', () => {
  vi.mocked(dep).mockImplementation(() => scope.name)
  expect(dep()).toBe('autospy')
})
    `,
        './d-do-mock.test.ts': `
import { expect, test, vi } from 'vitest'
${trackScope('vi.doMock factory')}
test('mocked', async () => {
  vi.doMock('./dep-d', () => ({ dep: () => scope.name }))
  const { dep } = await import('./dep-d')
  expect(dep()).toBe('vi.doMock factory')
})
    `,
        './e-import-mock.test.ts': `
import { expect, test, vi } from 'vitest'
import { dep } from './dep-e'
${trackScope('vi.importMock factory')}
vi.mock('./dep-e', () => ({ dep: () => scope.name }))
test('mocked', async () => {
  const mocked = await vi.importMock('./dep-e')
  expect(mocked.dep).toBe(dep)
})
    `,
        './f-unused-do-mock.test.ts': `
import { test, vi } from 'vitest'
${trackScope('unused vi.doMock factory')}
test('mock is never imported', () => {
  vi.doMock('./dep-f', () => ({ dep: () => scope.name }))
})
    `,
        './z-released.test.ts': `
import v8 from 'node:v8'
import vm from 'node:vm'
import { expect, test } from 'vitest'

v8.setFlagsFromString('--expose-gc')
const gc = vm.runInNewContext('gc')
v8.setFlagsFromString('--no-expose-gc')

test('mock factories of previous files are released', async () => {
  expect(globalThis.scopes).toHaveLength(6)
  let retained = []
  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10))
    gc()
    retained = globalThis.scopes.map((ref) => ref.deref()?.name).filter(Boolean)
    if (!retained.length) {
      break
    }
  }
  expect(retained).toEqual([])
})
    `,
      },
      {
        pool,
        isolate: false,
        sequence: { sequencer: StableTestFileOrderSorter },
      },
    )

    expect(stderr).toBe('')
    expect(errorTree()).toMatchInlineSnapshot(`
      {
        "a-factory.test.ts": {
          "mocked": "passed",
        },
        "b-automock.test.ts": {
          "mocked": "passed",
        },
        "c-autospy.test.ts": {
          "mocked": "passed",
        },
        "d-do-mock.test.ts": {
          "mocked": "passed",
        },
        "e-import-mock.test.ts": {
          "mocked": "passed",
        },
        "f-unused-do-mock.test.ts": {
          "mock is never imported": "passed",
        },
        "z-released.test.ts": {
          "mock factories of previous files are released": "passed",
        },
      }
    `)
  },
)

test.for(['forks', 'vmThreads'])('mocks of finished files do not apply (%s)', async (pool) => {
  const realTest = `
import { expect, test } from 'vitest'
import * as dep from './dep'
import * as other from './other'
test('real', () => {
  expect(Object.keys(dep)).toEqual(['dep'])
  expect(dep.dep()).toBe('real')
  expect(other.other()).toBe('real other')
})
`
  const { stderr, errorTree } = await runInlineTests(
    {
      './dep.ts': `export const dep = () => 'real'`,
      './other.ts': `export const other = () => 'real other'`,
      './__mocks__/other.ts': `export const other = () => '__mocks__ other'`,
      './a-factory.test.ts': `
import { expect, test, vi } from 'vitest'
import { dep } from './dep'
vi.mock('./dep', () => ({ dep: () => 'factory' }))
test('factory', () => {
  expect(dep()).toBe('factory')
})
    `,
      './b-real.test.ts': realTest,
      './c-automock.test.ts': `
import { expect, test, vi } from 'vitest'
import { dep } from './dep'
vi.mock('./dep')
test('automock', () => {
  expect(vi.isMockFunction(dep)).toBe(true)
  expect(dep()).toBe(undefined)
})
    `,
      './d-real.test.ts': realTest,
      './e-autospy.test.ts': `
import { expect, test, vi } from 'vitest'
import { dep } from './dep'
vi.mock('./dep', { spy: true })
test('autospy', () => {
  expect(dep()).toBe('real')
  expect(dep).toHaveBeenCalledTimes(1)
})
    `,
      './f-import-original.test.ts': `
import { expect, test, vi } from 'vitest'
import * as dep from './dep'
vi.mock(import('./dep'), async (importOriginal) => ({ ...await importOriginal(), extra: true }))
test('importOriginal', () => {
  expect(dep).toMatchObject({ extra: true })
  expect(dep.dep()).toBe('real')
})
    `,
      './g-redirect.test.ts': `
import { expect, test, vi } from 'vitest'
import { other } from './other'
vi.mock('./other')
test('__mocks__', () => {
  expect(other()).toBe('__mocks__ other')
})
    `,
      './h-real.test.ts': realTest,
      './i-unused-do-mock.test.ts': `
import { test, vi } from 'vitest'
test('mock is never imported', () => {
  vi.doMock('./dep', () => ({ dep: () => 'unused vi.doMock' }))
})
    `,
      './j-real.test.ts': realTest,
      './k-import-mock.test.ts': `
import { expect, test, vi } from 'vitest'
import { dep } from './dep'
vi.mock('./dep', () => ({ dep: () => 'factory' }))
test('importMock', async () => {
  const mocked = await vi.importMock('./dep')
  expect(mocked.dep).toBe(dep)
  expect(dep()).toBe('factory')
})
    `,
      './l-real.test.ts': realTest,
    },
    {
      pool,
      isolate: false,
      sequence: { sequencer: StableTestFileOrderSorter },
    },
  )

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "a-factory.test.ts": {
        "factory": "passed",
      },
      "b-real.test.ts": {
        "real": "passed",
      },
      "c-automock.test.ts": {
        "automock": "passed",
      },
      "d-real.test.ts": {
        "real": "passed",
      },
      "e-autospy.test.ts": {
        "autospy": "passed",
      },
      "f-import-original.test.ts": {
        "importOriginal": "passed",
      },
      "g-redirect.test.ts": {
        "__mocks__": "passed",
      },
      "h-real.test.ts": {
        "real": "passed",
      },
      "i-unused-do-mock.test.ts": {
        "mock is never imported": "passed",
      },
      "j-real.test.ts": {
        "real": "passed",
      },
      "k-import-mock.test.ts": {
        "importMock": "passed",
      },
      "l-real.test.ts": {
        "real": "passed",
      },
    }
  `)
})
