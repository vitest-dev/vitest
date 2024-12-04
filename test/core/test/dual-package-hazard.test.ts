import { createRequire } from 'node:module'
// @ts-expect-error no ts
import * as dep1 from '@vitest/test-dep1'

// @ts-expect-error no ts
import * as dep2 from '@vitest/test-dep2'

// @ts-expect-error no ts
import depEsmComment from '@vitest/test-dep-cjs/esm-comment'

// @ts-expect-error no ts
import depEsmString from '@vitest/test-dep-cjs/esm-string'

import { expect, test } from 'vitest'

const require = createRequire(import.meta.url)

test('no dual package hazard by externalizing esm deps by default', async () => {
  dep1.data.hello = 'world'
  expect(dep2.data.hello).toBe('world')
})

test('externalize cjs with esm comment', async () => {
  const depEsmCommentRequire = require('@vitest/test-dep-cjs/esm-comment')
  expect(depEsmComment).toBe(depEsmCommentRequire)
})

test('externalize cjs with esm string', async () => {
  const depEsmStringRequire = require('@vitest/test-dep-cjs/esm-string')
  expect(depEsmString).toBe(depEsmStringRequire)
})
