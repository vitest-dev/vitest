import { describe, expect, it, vi } from 'vitest'
import { isSameFilePath, normalizeWindowsDriveLetter } from '../../../packages/vitest/src/runtime/utils/paths'

vi.mock('fs', () => {
  return {
    existsSync: vi.fn(),
  }
})

describe('isSameFilePath', () => {
  it('matches windows paths that only differ by drive letter casing', () => {
    expect(isSameFilePath('c:/project/test.ts', 'C:/project/test.ts', 'win32')).toBe(true)
    expect(isSameFilePath('C:\\project\\test.ts', 'c:\\project\\test.ts', 'win32')).toBe(true)
  })

  it('does not normalize non-drive-letter casing', () => {
    expect(isSameFilePath('C:/project/Test.ts', 'C:/project/test.ts', 'win32')).toBe(false)
  })

  it('preserves case-sensitive comparisons on non-windows platforms', () => {
    expect(isSameFilePath('c:/project/test.ts', 'C:/project/test.ts', 'linux')).toBe(false)
  })
})

describe('normalizeWindowsDriveLetter', () => {
  it('normalizes only the drive letter on windows', () => {
    expect(normalizeWindowsDriveLetter('C:/project/Test.ts', 'win32')).toBe('c:/project/Test.ts')
    expect(normalizeWindowsDriveLetter('D:\\project\\Test.ts', 'win32')).toBe('d:\\project\\Test.ts')
  })

  it('does not change non-windows paths', () => {
    expect(normalizeWindowsDriveLetter('C:/project/Test.ts', 'linux')).toBe('C:/project/Test.ts')
    expect(normalizeWindowsDriveLetter('/project/Test.ts', 'win32')).toBe('/project/Test.ts')
  })
})

const isWindows = process.platform === 'win32'

describe('current url', () => {
  it('__filename is equal to import.meta.url', () => {
    expect(__filename).toEqual(import.meta.filename)
  })

  it('__dirname is equal to import.meta.dirname', () => {
    expect(__dirname).toEqual(import.meta.dirname)
  })

  describe.runIf(!isWindows)('unix', () => {
    it('__filename', () => {
      expect(__filename.startsWith('file://')).toBe(false)
      expect(__filename.endsWith('test/unit/test/file-path.test.ts')).toBe(true)
    })

    it('__dirname', () => {
      expect(__dirname.startsWith('file://')).toBe(false)
      expect(__dirname.endsWith('test/unit/test')).toBe(true)
    })

    it('import.meta.url', () => {
      expect(import.meta.url.startsWith('file://')).toBe(true)
      expect(import.meta.url.endsWith('test/unit/test/file-path.test.ts')).toBe(true)
    })
  })

  describe.runIf(isWindows)('windows', () => {
    // consistently inconsistent with Node, CJS has \, ESM has /
    const cwd = process.cwd()
    const windowsDrive = `${cwd[0].toUpperCase()}:\\`
    const drivePosix = `${cwd[0].toUpperCase()}:/`

    it('__filename', () => {
      expect(__filename.startsWith('file://')).toBe(false)
      expect(__filename.startsWith(windowsDrive + windowsDrive)).toBe(false)
      expect(__filename.startsWith(windowsDrive)).toBe(true)
      expect(__filename.endsWith('\\test\\unit\\test\\file-path.test.ts')).toBe(true)
    })

    it('__dirname', () => {
      expect(__dirname.startsWith('file://')).toBe(false)
      expect(__dirname.startsWith(windowsDrive + windowsDrive)).toBe(false)
      expect(__dirname.startsWith(windowsDrive)).toBe(true)
      expect(__dirname.endsWith('\\test\\unit\\test')).toBe(true)
    })

    it('import.meta.url', () => {
      expect(import.meta.url.startsWith(`file:///${drivePosix}`)).toBe(true)
      expect(import.meta.url.endsWith('test/unit/test/file-path.test.ts')).toBe(true)
    })
  })
})
