import { expect, test } from 'vitest'
import cjsDefault from '@vitest/cjs-lib'
import * as cjsNamespace from '@vitest/cjs-lib'

test('cjs namespace import', () => {
  expect(cjsNamespace).toEqual({
    a: 'a',
    b: 'b',
    object: {
      h: 'h',
    },
  })
})

test('cjs default import not supported when slowHijackESM', () => {
  expect(cjsDefault).toBeUndefined()
})
