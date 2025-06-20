import { expect, test } from 'vitest'
import * as transpiled from '../src/pre-transpiled/transpiled.js'

test('run pre-transpiled sources', () => {
  expect(transpiled.hello).toBeTypeOf('function')
  expect(transpiled.hello()).toBeUndefined()
})
