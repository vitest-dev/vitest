// @vitest-environment jsdom

import * as modDefaultCjs from '../src/external/default-cjs.cjs'

vi.mock('../src/external/default-cjs.cjs')

test('default is mocked', () => {
  expect(vi.isMockFunction(modDefaultCjs.default.fn)).toBe(true)
})
