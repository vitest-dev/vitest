// @vitest-environment happy-dom

import { expect, test } from 'vitest'
import pkgBrowser from '../src/external/pkg-browser'
import pkgNode from '../src/external/pkg-node'

test('[web] resolves to ssr, when node is first in conditions', () => {
  expect(pkgNode).toBe('ssr')
})

test('[web] resolves to ssr, when browser is first in conditions', () => {
  expect(pkgBrowser).toBe('ssr')
})
