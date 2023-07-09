import { expect, test } from 'vitest'
import { implicitElse } from '../src/implicitElse'
import { useImportEnv } from '../src/importEnv'
import { second } from '../src/function-count'
import { runDynamicFileCJS, runDynamicFileESM } from '../src/dynamic-files'

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

test.skipIf(skipDynamicFiles)('run dynamic ESM file', async () => {
  await runDynamicFileESM()
})

test.skipIf(skipDynamicFiles)('run dynamic CJS file', async () => {
  await runDynamicFileCJS()
})
