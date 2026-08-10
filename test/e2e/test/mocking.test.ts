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
