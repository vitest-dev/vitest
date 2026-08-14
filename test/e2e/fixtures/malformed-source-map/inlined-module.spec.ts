import { test } from 'vitest'
import testMalformedSourceMap from './malformed-source-map.js'

test('reports the original module error', () => {
  testMalformedSourceMap()
})
