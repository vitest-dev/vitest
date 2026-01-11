/* eslint-disable unicorn/prefer-node-protocol */

import fs from 'fs/promises'
import { expect, test, vi } from 'vitest'

vi.mock(import('fs/promises'), async (importOriginal) => {
  const { default: original } = await importOriginal()
  return {
    default: {
      ...original,
      readFile: vi.fn(),
    },
  }
})

test('fs is defined when node: prefix is not used', () => {
  expect(vi.isMockFunction(fs.readFile)).toBe(true)
})
