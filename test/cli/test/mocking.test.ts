import type { RunVitestConfig } from '../../test-utils'
import { setDefaultResultOrder } from 'node:dns'
import path from 'node:path'
import { playwright } from '@vitest/browser-playwright'
import { webdriverio } from '@vitest/browser-webdriverio'
import { afterAll, expect, test } from 'vitest'
import { rolldownVersion } from 'vitest/node'
import { runInlineTests, runVitest } from '../../test-utils'

// webdriver@9 sets dns.setDefaultResultOrder("ipv4first") on import,
// which makes Vite resolve localhost to 127.0.0.1 and breaks other tests asserting "localhost"
afterAll(() => setDefaultResultOrder('verbatim'))

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

  // requires Vite 8 for relaxed import analysis validataion
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

  if (rolldownVersion) {
    expect(errorTree()).toMatchInlineSnapshot(`
      {
        "basic.test.js": {
          "can mock invalid module": "passed",
        },
      }
    `)
  }
  else {
    expect(errorTree()).toMatchInlineSnapshot(`
      {
        "basic.test.js": {
          "can mock invalid module": "passed",
        },
      }
    `)
  }
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
  if (mode === 'webdriverio') {
    return {
      browser: {
        enabled: true,
        provider: webdriverio(),
        instances: [{ browser: 'chrome' }],
        headless: true,
      },
    }
  }
  return {}
}

test.for(['node', 'playwright', 'webdriverio'])('importOriginal for virtual modules (%s)', async (mode) => {
  const { stderr, errorTree, root } = await runInlineTests({
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

  // webdriverio uses a server-side interceptor plugin whose load hook
  // intercepts the clean id, so importActual returns the mock instead
  // of the original module. This is a known limitation.
  if (mode === 'webdriverio') {
    const tree = errorTree()
    tree['basic.test.js'].__module_errors__ = tree['basic.test.js'].__module_errors__.map(
      (e: string) => e.replace(root, '<root>'),
    )
    expect(tree).toMatchInlineSnapshot(`
      {
        "__unhandled_errors__": [
          "[vitest] There was an error when mocking a module. If you are using "vi.mock" factory, make sure there are no top level variables inside, since this call is hoisted to top of the file. Read more: https://vitest.dev/api/vi.html#vi-mock",
        ],
        "basic.test.js": {
          "__module_errors__": [
            "Failed to import test file <root>/basic.test.js",
          ],
        },
      }
    `)
  }
  else {
    expect(stderr).toBe('')
    expect(errorTree()).toMatchInlineSnapshot(`
      {
        "basic.test.js": {
          "importOriginal returns original virtual module exports": "passed",
        },
      }
    `)
  }
})

test.for(['node', 'playwright', 'webdriverio'])('mocking virtual module without importOriginal skips loading original (%s)', async (mode) => {
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
