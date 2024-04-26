import { expect, test } from 'vitest'

// @ts-expect-error network imports
import slash from 'http://localhost:9602/slash@3.0.0.js'

// test without local server
// import slash from 'https://esm.sh/slash@3.0.0'

test('network imports', () => {
  expect(slash('foo\\bar')).toBe('foo/bar')
})
