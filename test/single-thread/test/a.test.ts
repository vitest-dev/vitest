import fs from 'node:fs'
import { expect, it, vi } from 'vitest'
import { timeout } from './timeout'

// this file is running first, it should not affect file "b.test.ts"
it('mock is mocked', () => {
  vi.spyOn(fs, 'readFileSync').mockReturnValue('mocked')
  expect(fs.readFileSync('')).toBe('mocked')
})

it('timeout', () => new Promise(resolve => setTimeout(resolve, timeout)))
