import { expect, test, vi } from 'vitest'

test.each([
  { platform: 'win32', id: 'file:///C:/Users/user/workspace/file.js', path: 'C:/Users/user/workspace/file.js' },
  { platform: 'darwin', id: 'file:///Users/user/workspace/file.js', path: '/Users/user/workspace/file.js' },
  { platform: 'linux', id: 'file:///Users/user/workspace/file.js', path: '/Users/user/workspace/file.js' },
] as { platform: NodeJS.Platform; id: string; path: string }[])(
  'normalizeRequestId should be normarlize file protocol path correctly in $platform',
  async ({
    platform,
    id,
    path,
  }) => {
    const mockPlatform = vi.spyOn(process, 'platform', 'get')

    mockPlatform.mockReturnValue(platform)

    const { normalizeRequestId } = await import('vite-node/utils')

    expect(normalizeRequestId(id)).toBe(path)

    mockPlatform.mockClear()
  },
)
