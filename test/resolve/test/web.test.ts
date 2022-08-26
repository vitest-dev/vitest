import { expect, test } from 'vitest'
import pkgNode from '../pkg-node'
import pkgBrowser from '../pkg-browser'

test('[web] resolves to ssr, when node is first in conditions', () => {
  expect(pkgNode).toBe('ssr')
})

test('[web] resolves to ssr, when browser is first in conditions', () => {
  expect(pkgBrowser).toBe('ssr')
})
