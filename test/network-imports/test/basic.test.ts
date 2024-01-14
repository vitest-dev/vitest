import { expect, test } from 'vitest'

// @ts-expect-error network imports
import slash from 'https://esm.sh/slash@5.1.0'

test('network imports', async () => {
  expect(slash('foo\\bar')).toBe('foo/bar')
})
