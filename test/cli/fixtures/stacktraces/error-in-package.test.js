import { test } from 'vitest'
import testStack from "@vitest/test-dep-error"
import testStackTs from "@vitest/test-dep-error/ts.ts"
import testStackTranspiled from "@vitest/test-dep-error/transpiled.js"
import testStackTranspiledInline from "@vitest/test-dep-error/transpiled-inline.js"

test('js', () => {
  testStack()
})

test('ts', () => {
  testStackTs()
})

test('transpiled', () => {
  testStackTranspiled()
})

test('transpiled inline', () => {
  testStackTranspiledInline()
})
