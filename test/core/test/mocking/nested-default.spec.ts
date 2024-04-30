// @vitest-environment jsdom

import sweetalert from 'sweetalert2'
import { expect, test, vi } from 'vitest'
// @ts-expect-error mocked module
import * as modDefaultCjs from '../../src/mocks/external/default-cjs.cjs'

vi.mock('sweetalert2')
vi.mock('../../src/mocks/external/default-cjs.cjs')

test('default is mocked', () => {
  expect(vi.isMockFunction(modDefaultCjs.default.fn)).toBe(true)
  expect(vi.isMockFunction(sweetalert)).toBe(true)
  expect(vi.isMockFunction(sweetalert.clickCancel)).toBe(true)
})
