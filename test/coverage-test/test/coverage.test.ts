import { describe, expect, test } from 'vitest'

// @ts-expect-error -- untyped virtual file provided by custom plugin
import virtualFile1 from 'virtual:vitest-custom-virtual-file-1'

import { implicitElse } from '../src/implicitElse'
import { useImportEnv } from '../src/importEnv'
import { second } from '../src/function-count'
import { runDynamicFileCJS, runDynamicFileESM } from '../src/dynamic-files'
import MultiSuite from '../src/multi-suite'
import { callExternal } from '../src/callExternal'

// @ts-expect-error -- untyped virtual file provided by custom plugin
import virtualFile2 from '\0vitest-custom-virtual-file-2'

// Browser mode crashes with dynamic files. Enable this when browser mode works.
// To keep istanbul report consistent between browser and node, skip dynamic tests when istanbul is used.
const skipDynamicFiles = globalThis.process?.env.COVERAGE_PROVIDER === 'istanbul' || !globalThis.process?.env.COVERAGE_PROVIDER

const { pythagoras } = await (() => {
  if ('__vitest_browser__' in globalThis)
    // TODO: remove workaround after vite 4.3.2
    // @ts-expect-error extension is not specified
    return import('../src/index')
  const dynamicImport = '../src/index.mjs'
  return import(dynamicImport)
})()

test('Math.sqrt()', async () => {
  expect(pythagoras(3, 4)).toBe(5)
})

test('implicit else', () => {
  expect(implicitElse(true)).toBe(2)
})

test('import meta env', () => {
  expect(useImportEnv()).toBe(true)
})

test('cover function counts', () => {
  expect(second()).toBe(2)
})

describe('Multiple test suites', () => {
  describe('func1()', () => {
    test('func1', () => {
      const data = ['a', 'b']
      const val = MultiSuite.func1(data)
      expect(val).toEqual(data)
    })
  })
  describe('func2()', () => {
    test('func2', () => {
      const data = ['c', 'd']
      const val = MultiSuite.func2(data)
      expect(val).toEqual(data)
    })
  })
})

test('calling external files', () => {
  expect(callExternal()).toBe('This line should be covered')
})

test.skipIf(skipDynamicFiles)('run dynamic ESM file', async () => {
  await runDynamicFileESM()
})

test.skipIf(skipDynamicFiles)('run dynamic CJS file', async () => {
  await runDynamicFileCJS()
})

test('virtual file imports', () => {
  expect(virtualFile1).toBe('This file should be excluded from coverage report #1')
  expect(virtualFile2).toBe('This file should be excluded from coverage report #2')
})
