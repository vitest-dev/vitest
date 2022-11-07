import { existsSync } from 'fs'
import { describe, expect, it, vi } from 'vitest'
import { isWindows, slash, toFilePath } from '../../../packages/vite-node/src/utils'

vi.mock('fs')

describe('toFilePath', () => {
  // the following tests will work incorrectly on unix systems
  if (isWindows) {
    it('windows', () => {
      const root = 'C:/path/to/project'
      const id = '/node_modules/pkg/file.js'
      const expected = 'C:/path/to/project/node_modules/pkg/file.js'

      const processSpy = vi.spyOn(process, 'cwd').mockReturnValue(root)
      const filePath = toFilePath(id, root)
      processSpy.mockRestore()

      expect(slash(filePath)).toEqual(expected)
    })

    it('windows with /@fs/', () => {
      const root = 'C:/path/to/project'
      const id = '/@fs/C:/path/to/project/node_modules/pkg/file.js'
      const expected = 'C:/path/to/project/node_modules/pkg/file.js'

      const processSpy = vi.spyOn(process, 'cwd').mockReturnValue(root)
      const filePath = toFilePath(id, root)
      processSpy.mockRestore()

      expect(slash(filePath)).toEqual(expected)
    })
  }

  // the following tests will work incorrectly on windows systems
  if (!isWindows) {
    it('unix', () => {
      const root = '/path/to/project'
      const id = '/node_modules/pkg/file.js'
      const expected = '/path/to/project/node_modules/pkg/file.js'

      const processSpy = vi.spyOn(process, 'cwd').mockReturnValue(root)
      const existsSpy = vi.mocked(existsSync).mockReturnValue(true)
      const filePath = toFilePath(id, root)
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
      const filePath = toFilePath(id, root)
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
      const filePath = toFilePath(id, root)
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
      const filePath = toFilePath(id, root)
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
      const filePath = toFilePath(id, root)
      processSpy.mockRestore()
      existsSpy.mockRestore()

      expect(slash(filePath)).toEqual(expected)
    })

    it('unix with sibling path', () => {
      const root = '/path/to/first/package'
      const id = '/path/to/second/package/file.js'

      const processSpy = vi.spyOn(process, 'cwd').mockReturnValue(root)
      const existsSpy = vi.mocked(existsSync).mockReturnValue(false)
      const filePath = toFilePath(id, root)
      processSpy.mockRestore()
      existsSpy.mockRestore()

      expect(slash(filePath)).toEqual(id)
    })
  }
})
