import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test.for([
  [undefined],
  [{ expand: false }],
])('inline diff options %o', async ([options]) => {
  const { stdout } = await runVitest({
    root: './fixtures/diff',
    diff: options,
    reporters: ['junit'],
  })
  const matches = stdout.matchAll(/<failure[^>]*>(.*)<\/failure>/gs)
  expect([...matches].map(m => m[1])).matchSnapshot()
})
