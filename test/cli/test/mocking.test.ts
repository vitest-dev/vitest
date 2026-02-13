import path from 'node:path'
import { expect, test } from 'vitest'
import { rolldownVersion } from 'vitest/node'
import { runInlineTests, runVitest } from '../../test-utils'

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
  const { results, errorTree } = await runVitest({
    root: path.join(import.meta.dirname, '../fixtures/invalid-package'),
  })
  const testModuleErrors = Object.fromEntries(
    results.map(testModule => [
      testModule.relativeModuleId,
      testModule.errors().map(e => e.message),
    ]),
  )

  // requires Vite 8 for relaxed import analysis validataion
  // https://github.com/vitejs/vite/pull/21601
  if (rolldownVersion) {
    expect(testModuleErrors).toMatchInlineSnapshot(`
      {
        "mock-bad-dep.test.ts": [],
        "mock-wrapper-and-bad-dep.test.ts": [],
        "mock-wrapper.test.ts": [],
      }
    `)
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
    expect(testModuleErrors).toMatchInlineSnapshot(`
      {
        "mock-bad-dep.test.ts": [
          "Failed to resolve entry for package "test-dep-invalid". The package may have incorrect main/module/exports specified in its package.json.",
        ],
        "mock-wrapper-and-bad-dep.test.ts": [
          "Failed to resolve entry for package "test-dep-invalid". The package may have incorrect main/module/exports specified in its package.json.",
        ],
        "mock-wrapper.test.ts": [
          "Failed to resolve entry for package "test-dep-invalid". The package may have incorrect main/module/exports specified in its package.json.",
        ],
      }
    `)
    expect(errorTree()).toMatchInlineSnapshot(`
        {
          "mock-bad-dep.test.ts": {},
          "mock-wrapper-and-bad-dep.test.ts": {},
          "mock-wrapper.test.ts": {},
        }
      `)
  }
})

test('mocking modules with syntax error', async () => {
  // TODO: manual mocked module still gets transformed so this is not supported yet.
  const { errorTree, results } = await runInlineTests({
    './syntax-error.js': `syntax error`,
    './basic.test.js': /* ts */ `
import * as dep from './syntax-error.js'

vi.mock('./syntax-error.js', () => {
  return { mocked: 'ok' }
})

test('can mock invalid module', () => {
  expect(dep).toMatchObject({ mocked: 'ok' })
})
    `,
  })

  const testModuleErrors = Object.fromEntries(
    results.map(testModule => [
      testModule.relativeModuleId,
      testModule.errors().map(e => e.message),
    ]),
  )
  if (rolldownVersion) {
    expect(testModuleErrors).toMatchInlineSnapshot(`
      {
        "basic.test.js": [
          "Parse failure: Parse failed with 1 error:
      Expected a semicolon or an implicit semicolon after a statement, but found none
      1: syntax error
               ^
      At file: /syntax-error.js:1:6",
        ],
      }
    `)
  }
  else {
    expect(testModuleErrors).toMatchInlineSnapshot(`
      {
        "basic.test.js": [
          "Parse failure: Expected ';', '}' or <eof>
      At file: /syntax-error.js:1:7",
        ],
      }
    `)
  }
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {},
    }
  `)
})
