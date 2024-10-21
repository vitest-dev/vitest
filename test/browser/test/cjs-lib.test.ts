import cjsDefault, { a as cjsNamed } from '@vitest/cjs-lib'
import * as cjsNamespace from '@vitest/cjs-lib'
import { expect, test } from 'vitest'

test('cjs namespace import', () => {
  expect(cjsNamespace).toEqual({
    a: 'a',
    b: 'b',
    object: {
      h: 'h',
    },
    default: {
      a: 'a',
      b: 'b',
      object: {
        h: 'h',
      },
    },
  })
})

test('cjs named import', () => {
  expect(cjsNamed).toEqual('a')
})

test('cjs default import not supported when slowHijackESM', () => {
  expect(cjsDefault).toEqual({
    a: 'a',
    b: 'b',
    object: {
      h: 'h',
    },
  })
})
