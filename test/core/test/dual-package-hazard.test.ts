import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

// @ts-expect-error no ts
import * as dep1 from '@vitest/test-dep1'

// @ts-expect-error no ts
import * as dep2 from '@vitest/test-dep2'

// @ts-expect-error no ts
import depEsmComment from '@vitest/test-dep-esm-comment'

const require = createRequire(import.meta.url)

test('no dual package hazard by externalizing esm deps by default', async () => {
  dep1.data.hello = 'world'
  expect(dep2.data.hello).toBe('world')
})

test('externalize cjs with esm comment', async () => {
  const depEsmCommentRequire = require('@vitest/test-dep-esm-comment')
  expect(depEsmComment).toBe(depEsmCommentRequire)
})
