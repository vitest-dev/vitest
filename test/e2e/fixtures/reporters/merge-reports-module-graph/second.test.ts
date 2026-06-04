import { test, expect } from 'vitest'
import { hello } from './util'
import * as obug from "obug"

test('also passes', () => {
  expect(hello()).toBe('Hello, graph!')
})

test('external', () => {
  expect(obug).toBeTypeOf('object')
})
