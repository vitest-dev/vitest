import { afterEach, describe, expect, it } from 'vitest'
import { isWindows, slash, toFilePath } from '../../../packages/vite-node/src/utils'

const originalCwd = process.cwd()

function mockCwd(cwd: string) {
  Object.defineProperty(process, 'cwd', {
    value: () => cwd,
  })
}

function restoreCwd() {
  Object.defineProperty(process, 'cwd', {
    value: originalCwd,
  })
}

describe('toFilePath', () => {
  afterEach(() => {
    restoreCwd()
  })

  if (isWindows) {
    // these test will work incorrectly on unix systems
    it('windows', () => {
      const root = 'C:/path/to/project'
      mockCwd(root)

      const id = '/node_modules/pkg/file.js'
      const expected = 'C:/path/to/project/node_modules/pkg/file.js'
      const filePath = toFilePath(id, root)
      expect(slash(filePath)).toEqual(expected)
    })

    it('windows with /@fs/', () => {
      const root = 'C:/path/to/project'
      mockCwd(root)

      const id = '/@fs/C:/path/to/project/node_modules/pkg/file.js'
      const expected = 'C:/path/to/project/node_modules/pkg/file.js'
      const filePath = toFilePath(id, root)
      expect(slash(filePath)).toEqual(expected)
    })
  }

  if (!isWindows) {
    // these test will work incorrectly on windows systems
    it('unix', () => {
      const root = '/path/to/project'
      mockCwd(root)

      const id = '/node_modules/pkg/file.js'
      const expected = '/path/to/project/node_modules/pkg/file.js'
      const filePath = toFilePath(id, root)
      expect(slash(filePath)).toEqual(expected)
    })

    it('unix with /@fs/', () => {
      const root = '/path/to/project'
      mockCwd(root)

      const id = '/@fs//path/to/project/node_modules/pkg/file.js'
      const expected = '/path/to/project/node_modules/pkg/file.js'
      const filePath = toFilePath(id, root)
      expect(slash(filePath)).toEqual(expected)
    })

    it('unix in first level catalog', () => {
      const root = '/root'
      mockCwd(root)

      const id = '/node_modules/pkg/file.js'
      const expected = '/root/node_modules/pkg/file.js'
      const filePath = toFilePath(id, root)
      expect(slash(filePath)).toEqual(expected)
    })

    it('unix with /@fs/ in first level catalog', () => {
      const root = '/root'
      mockCwd(root)

      const id = '/@fs//root/node_modules/pkg/file.js'
      const expected = '/root/node_modules/pkg/file.js'
      const filePath = toFilePath(id, root)
      expect(slash(filePath)).toEqual(expected)
    })
  }
})
