import '../src/external/external.mjs'
import { expect, test, vi } from 'vitest'
import axios from 'axios'
import defaultFunc from '../src/external/default-function.cjs'

vi.mock('../src/external/default-function.cjs')

test('axios is mocked', () => {
  expect(vi.isMockFunction(axios.get)).toBe(true)
})

test('defaultFunc is mocked', () => {
  expect(vi.isMockFunction(defaultFunc)).toBe(true)
})
