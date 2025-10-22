import { describe, expect, it, vi } from 'vitest'

vi.mock('fs', () => {
  return {
    existsSync: vi.fn(),
  }
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
      expect(__filename.endsWith('test/core/test/file-path.test.ts')).toBe(true)
    })

    it('__dirname', () => {
      expect(__dirname.startsWith('file://')).toBe(false)
      expect(__dirname.endsWith('test/core/test')).toBe(true)
    })

    it('import.meta.url', () => {
      expect(import.meta.url.startsWith('file://')).toBe(true)
      expect(import.meta.url.endsWith('test/core/test/file-path.test.ts')).toBe(true)
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
      expect(__filename.endsWith('\\test\\core\\test\\file-path.test.ts')).toBe(true)
    })

    it('__dirname', () => {
      expect(__dirname.startsWith('file://')).toBe(false)
      expect(__dirname.startsWith(windowsDrive + windowsDrive)).toBe(false)
      expect(__dirname.startsWith(windowsDrive)).toBe(true)
      expect(__dirname.endsWith('\\test\\core\\test')).toBe(true)
    })

    it('import.meta.url', () => {
      expect(import.meta.url.startsWith(`file:///${drivePosix}`)).toBe(true)
      expect(import.meta.url.endsWith('test/core/test/file-path.test.ts')).toBe(true)
    })
  })
})
