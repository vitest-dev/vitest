import { expect, test } from 'vitest'
import testMalformedSourceMap from './malformed-source-map.js'

test('passing test remains visible', () => {
  expect(true).toBe(true)
})

test('reports the original module error', () => {
  testMalformedSourceMap()
})
