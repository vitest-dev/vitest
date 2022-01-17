import '../src/external.mjs'
import { expect, test, vi } from 'vitest'
import axios from 'axios'

test('axios is mocked', () => {
  expect(vi.isMockFunction(axios.get)).toBe(true)
})
