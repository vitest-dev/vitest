/* eslint-disable perfectionist/sort-imports */
import { expect, test, vi } from 'vitest'
import '../../src/mocks/external/external.mjs'
import axios from 'axios'
// @ts-expect-error mocked module
import defaultFunc from '../../src/mocks/external/default-function.cjs'

vi.mock('../../src/mocks/external/default-function.cjs')

test('axios is mocked', () => {
  expect(vi.isMockFunction(axios.get)).toBe(true)
})

test('defaultFunc is mocked', () => {
  expect(vi.isMockFunction(defaultFunc)).toBe(true)
})
