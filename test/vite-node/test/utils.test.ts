import { describe, expect, test } from 'vitest'
import { pathFromRoot } from 'vite-node/utils'

describe('vite-node utils', () => {
  test('usual path from root returns correct path', () => {
    const root = '/Users/name/project'
    const filename = '/Users/name/project/test.ts'
    expect(pathFromRoot(root, filename)).toBe('/test.ts')
  })

  test('correct path when file and directory share a name', () => {
    const root = '/Users/name/project/test'
    const filename = '/Users/name/project/test/test/test.ts'
    expect(pathFromRoot(root, filename)).toBe('/test/test.ts')
  })

  test('correct path for node builtins', () => {
    const root = '/Users/name/project'
    const filename = 'fs'
    expect(pathFromRoot(root, filename)).toBe('fs')
  })

  test('correct path when relative path has back symbols', () => {
    const root = '/Users/name/project'
    const filename = '/Users/name/project/../test/test.ts'
    expect(pathFromRoot(root, filename)).toBe('/test/test.ts')
  })

  test('correct path when name has a dot at the start', () => {
    const root = '/Users/name/project'
    const filename = '/Users/name/project/.test.ts'
    expect(pathFromRoot(root, filename)).toBe('/.test.ts')
  })

  test('correct path when subfolder has a dot at the start', () => {
    const root = '/Users/name/project'
    const filename = '/Users/name/project/../.test/test.ts'
    expect(pathFromRoot(root, filename)).toBe('/.test/test.ts')
  })
})
