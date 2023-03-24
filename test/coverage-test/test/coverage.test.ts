import { expect, test } from 'vitest'
import { implicitElse } from '../src/implicitElse'
import { useImportEnv } from '../src/importEnv'

// TODO Fix: Browser fails to load if extensions ".mjs" is used
// @ts-expect-error -- extension
import { pythagoras } from '../src/index'

test('Math.sqrt()', async () => {
  expect(pythagoras(3, 4)).toBe(5)
})

test('implicit else', () => {
  expect(implicitElse(true)).toBe(2)
})

test('import meta env', () => {
  expect(useImportEnv()).toBe(true)
})
