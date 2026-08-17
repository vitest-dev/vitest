import { test } from 'vitest'
import testMalformedSourceMap from '@test/test-dep-malformed-source-map/external-map'

test('reports the original module error', () => {
  testMalformedSourceMap()
})
