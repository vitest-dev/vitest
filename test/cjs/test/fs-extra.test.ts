import fs, { existsSync } from 'fs-extra'
import { describe, expect, it } from 'vitest'

describe('fs-extra', () => {
  it('default export', () => {
    expect(fs.existsSync('test/fs-extra.test.ts')).toBe(true)
  })

  it('named export', () => {
    expect(existsSync('test/fs-extra.test.ts')).toBe(true)
  })
})
