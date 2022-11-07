import { expect, test } from 'vitest'
import pkgNode from '../pkg-node'
import pkgBrowser from '../pkg-browser'

test('[ssr] resolves to ssr, when node is first in conditions', () => {
  expect(pkgNode).toBe('ssr')
})

test('[ssr] resolves to ssr, when browser is first in conditions', () => {
  expect(pkgBrowser).toBe('ssr')
})
