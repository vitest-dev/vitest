/* eslint-disable perfectionist/sort-imports */
import { expect, test, vi } from 'vitest'
import '../../src/mocks/external/external.mjs'
import httpClient from 'http-client'
// @ts-expect-error mocked module
import defaultFunc from '../../src/mocks/external/default-function.cjs'

vi.mock('../../src/mocks/external/default-function.cjs')

test('http-client is mocked', () => {
  expect(vi.isMockFunction(httpClient.get)).toBe(true)
})

test('defaultFunc is mocked', () => {
  expect(vi.isMockFunction(defaultFunc)).toBe(true)
})
