// @vitest-environment jsdom

import nestedCjs from '@vitest/test-dep-nested-cjs'
import { expect, test, vi } from 'vitest'
// @ts-expect-error mocked module
import * as modDefaultCjs from '../../src/mocks/external/default-cjs.cjs'

vi.mock('@vitest/test-dep-nested-cjs')
vi.mock('../../src/mocks/external/default-cjs.cjs')

test('default is mocked', () => {
  expect(vi.isMockFunction(modDefaultCjs.default.fn)).toBe(true)
  expect(vi.isMockFunction(nestedCjs)).toBe(true)
  expect(vi.isMockFunction(nestedCjs.clickCancel)).toBe(true)
})
