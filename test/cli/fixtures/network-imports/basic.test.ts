import { expect, test } from 'vitest'

// @ts-expect-error network imports
import slash from 'http://localhost:9602/slash@3.0.0.js'

// test without local server
// import slash from 'https://esm.sh/slash@3.0.0'

test('network imports', () => {
  expect(slash('foo\\bar')).toBe('foo/bar')
})

test('doesn\'t work for http outside localhost', async () => {
  // @ts-expect-error network imports
  await expect(() => import('http://100.0.0.0/')).rejects.toThrowError(
    'import of \'http://100.0.0.0/\' by undefined is not supported: http can only be used to load local resources (use https instead).',
  )
})
