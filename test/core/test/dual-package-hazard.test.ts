import { expect, test } from 'vitest'

// @ts-expect-error no ts
import * as dep1 from '@vitest/test-dep1'

// @ts-expect-error no ts
import * as dep2 from '@vitest/test-dep2'

test('no dual package hazard by externalizing esm deps by default', async () => {
  dep1.data.hello = 'world'
  expect(dep2.data.hello).toBe('world')
})
