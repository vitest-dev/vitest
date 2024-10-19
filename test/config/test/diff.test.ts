import { describe } from 'node:test'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

describe('inline diff options', () => {
  test.for([
    [undefined],
    [{ expand: false }],
  ])('options %o', async ([options]) => {
    const { stdout } = await runVitest({
      root: './fixtures/diff',
      diff: options,
      reporters: ['junit'],
    })
    const matches = stdout.matchAll(/<failure[^>]*>(.*)<\/failure>/gs)
    expect([...matches].map(m => m[1])).matchSnapshot()
  })
})
