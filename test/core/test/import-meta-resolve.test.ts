import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import * as vite from 'vite'
import { expect, test } from 'vitest'

const require = createRequire(import.meta.url)

// requires Vite 7.1
const [major, minor] = vite.version.split('.').map(Number)
const supported = (major > 7 || (major === 7 && minor >= 1))

test('import.meta.resolve relative', () => {
  try {
    expect(import.meta.resolve('./import-meta-resolve.test.ts')).toBe(import.meta.url)
    expect(supported).toBe(true)
  }
  catch (e: any) {
    expect(e.message).toContain(`"import.meta.resolve" is not supported`)
    expect(supported).toBe(false)
  }
})

test('import.meta.resolve package', () => {
  try {
    const expected = pathToFileURL(require.resolve('react')).href
    expect(import.meta.resolve('react')).toBe(expected)
    expect(supported).toBe(true)
  }
  catch (e: any) {
    expect(e.message).toContain(`"import.meta.resolve" is not supported`)
    expect(supported).toBe(false)
  }
})
