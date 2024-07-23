import { existsSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { isWindows, slash, toFilePath } from '../../../packages/vite-node/src/utils'

vi.mock('fs', () => {
  return {
    existsSync: vi.fn(),
  }
})

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

describe('toFilePath', () => {
  // the following tests will work incorrectly on unix systems
  describe.runIf(isWindows)('windows', () => {
    it('windows', () => {
      const root = 'C:/path/to/project'
      const id = '/node_modules/pkg/file.js'
      const expected = 'C:/path/to/project/node_modules/pkg/file.js'

      const processSpy = vi.spyOn(process, 'cwd').mockReturnValue(root)
      const { path: filePath } = toFilePath(id, root)
      processSpy.mockRestore()

      expect(slash(filePath)).toEqual(expected)
    })

    it('windows with /@fs/', () => {
      const root = 'C:/path/to/project'
      const id = '/@fs/C:/path/to/project/node_modules/pkg/file.js'
      const expected = 'C:/path/to/project/node_modules/pkg/file.js'

      const processSpy = vi.spyOn(process, 'cwd').mockReturnValue(root)
      const { path: filePath } = toFilePath(id, root)
      processSpy.mockRestore()

      expect(slash(filePath)).toEqual(expected)
    })
  })

  // the following tests will work incorrectly on windows systems
  describe.runIf(!isWindows)('unix', () => {
    it('unix', () => {
      const root = '/path/to/project'
      const id = '/node_modules/pkg/file.js'
      const expected = '/path/to/project/node_modules/pkg/file.js'

      const processSpy = vi.spyOn(process, 'cwd').mockReturnValue(root)
      const existsSpy = vi.mocked(existsSync).mockReturnValue(true)
      const { path: filePath } = toFilePath(id, root)
      processSpy.mockRestore()
      existsSpy.mockRestore()

      expect(slash(filePath)).toEqual(expected)
    })

    it('unix with /@fs/', () => {
      const root = '/path/to/project'
      const id = '/@fs//path/to/project/node_modules/pkg/file.js'
      const expected = '/path/to/project/node_modules/pkg/file.js'

      const processSpy = vi.spyOn(process, 'cwd').mockReturnValue(root)
      const existsSpy = vi.mocked(existsSync).mockReturnValue(true)
      const { path: filePath } = toFilePath(id, root)
      processSpy.mockRestore()
      existsSpy.mockRestore()

      expect(slash(filePath)).toEqual(expected)
    })

    it('unix in first level catalog', () => {
      const root = '/root'
      const id = '/node_modules/pkg/file.js'
      const expected = '/root/node_modules/pkg/file.js'

      const processSpy = vi.spyOn(process, 'cwd').mockReturnValue(root)
      const existsSpy = vi.mocked(existsSync).mockReturnValue(true)
      const { path: filePath } = toFilePath(id, root)
      processSpy.mockRestore()
      existsSpy.mockRestore()

      expect(slash(filePath)).toEqual(expected)
    })

    it('unix with /@fs/ in first level catalog', () => {
      const root = '/root'
      const id = '/@fs//root/node_modules/pkg/file.js'
      const expected = '/root/node_modules/pkg/file.js'

      const processSpy = vi.spyOn(process, 'cwd').mockReturnValue(root)
      const existsSpy = vi.mocked(existsSync).mockReturnValue(true)
      const { path: filePath } = toFilePath(id, root)
      processSpy.mockRestore()
      existsSpy.mockRestore()

      expect(slash(filePath)).toEqual(expected)
    })

    it('unix with absolute path in first level catalog', () => {
      const root = '/root'
      const id = '/root/path/to/file.js'
      const expected = '/root/path/to/file.js'

      const processSpy = vi.spyOn(process, 'cwd').mockReturnValue(root)
      const existsSpy = vi.mocked(existsSync).mockReturnValue(true)
      const { path: filePath } = toFilePath(id, root)
      processSpy.mockRestore()
      existsSpy.mockRestore()

      expect(slash(filePath)).toEqual(expected)
    })

    it('unix with sibling path', () => {
      const root = '/path/to/first/package'
      const id = '/path/to/second/package/file.js'

      const processSpy = vi.spyOn(process, 'cwd').mockReturnValue(root)
      const existsSpy = vi.mocked(existsSync).mockReturnValue(false)
      const { path: filePath } = toFilePath(id, root)
      processSpy.mockRestore()
      existsSpy.mockRestore()

      expect(slash(filePath)).toEqual(id)
    })
  })
})
