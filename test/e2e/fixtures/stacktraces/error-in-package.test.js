import { test } from 'vitest'
import testStack from "@test/test-dep-error"
import testStackTs from "@test/test-dep-error/ts.ts"
import testStackTranspiled from "@test/test-dep-error/transpiled.js"
import testStackTranspiledInline from "@test/test-dep-error/transpiled-inline.js"

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
