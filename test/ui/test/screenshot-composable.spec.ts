import type { RunnerTask } from 'vitest'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { getScreenshotUrls, hasScreenshot } from '../../../packages/ui/client/composables/screenshot'

// Mock window.VITEST_API_TOKEN for Node.js test environment
beforeEach(() => {
  vi.stubGlobal('window', { VITEST_API_TOKEN: 'test-token' })
})

describe('screenshot composable', () => {
  describe('getScreenshotUrls', () => {
    test('deduplicates when same screenshot is in both failScreenshotPath and screenshotPaths', () => {
      const task = {
        meta: {
          screenshotPaths: [
            '/path/to/test-auto-mobile.png',
          ],
          failScreenshotPath: '/path/to/test-auto-mobile.png', // Same path!
        },
      } as unknown as RunnerTask

      const urls = getScreenshotUrls(task)

      // Should deduplicate to 1 URL, not 2
      expect(urls.length).toBe(1)
      expect(urls[0]).toContain('test-auto-mobile.png')

      // Extract path from URL to verify it's correct
      const urlPath = decodeURIComponent(urls[0].match(/path=([^&]+)/)?.[1] || '')
      expect(urlPath).toBe('/path/to/test-auto-mobile.png')
    })

    test('handles manual screenshots correctly', () => {
      const task = {
        meta: {
          screenshotPaths: [
            '/path/to/test-1-mobile.png',
            '/path/to/test-2-mobile.png',
          ],
        },
      } as RunnerTask

      const urls = getScreenshotUrls(task)

      expect(urls.length).toBe(2)
      expect(urls[0]).toContain('test-1-mobile.png')
      expect(urls[1]).toContain('test-2-mobile.png')
    })

    test('sorts auto screenshots before manual screenshots', () => {
      const task = {
        meta: {
          screenshotPaths: [
            '/path/to/test-1-mobile.png',
            '/path/to/test-2-mobile.png',
            '/path/to/test-auto-mobile.png', // Auto screenshot should come first
          ],
        },
      } as RunnerTask

      const urls = getScreenshotUrls(task)

      expect(urls.length).toBe(3)

      // First URL should be the auto screenshot
      expect(urls[0]).toContain('test-auto-mobile.png')

      // Then manual screenshots in order
      expect(urls[1]).toContain('test-1-mobile.png')
      expect(urls[2]).toContain('test-2-mobile.png')
    })

    test('handles mixed manual, auto, and failure screenshots with deduplication', () => {
      const task = {
        meta: {
          screenshotPaths: [
            '/path/to/test-1-mobile.png',
            '/path/to/test-auto-mobile.png', // Also in failScreenshotPath
            '/path/to/test-2-mobile.png',
          ],
          failScreenshotPath: '/path/to/test-auto-mobile.png', // Duplicate
        },
      } as RunnerTask

      const urls = getScreenshotUrls(task)

      // Should deduplicate the auto screenshot, resulting in 3 unique URLs
      expect(urls.length).toBe(3)

      // Auto screenshot should be first
      expect(urls[0]).toContain('test-auto-mobile.png')

      // Manual screenshots should follow in order
      expect(urls[1]).toContain('test-1-mobile.png')
      expect(urls[2]).toContain('test-2-mobile.png')
    })

    test('returns empty array when no screenshots exist', () => {
      const task = {
        meta: {},
      } as RunnerTask

      const urls = getScreenshotUrls(task)

      expect(urls.length).toBe(0)
    })

    test('filters out null or undefined screenshot paths', () => {
      const task = {
        meta: {
          screenshotPaths: [
            '/path/to/test-1.png',
            null as any,
            '/path/to/test-2.png',
            undefined as any,
          ],
        },
      } as RunnerTask

      const urls = getScreenshotUrls(task)

      // Should only include the 2 valid paths
      expect(urls.length).toBe(2)
      expect(urls[0]).toContain('test-1.png')
      expect(urls[1]).toContain('test-2.png')
    })

    test('URL encoding handles special characters in paths', () => {
      const task = {
        meta: {
          screenshotPaths: [
            '/path/to/test with spaces.png',
            '/path/to/test-with-特殊字符.png',
          ],
        },
      } as RunnerTask

      const urls = getScreenshotUrls(task)

      expect(urls.length).toBe(2)

      // Verify paths are properly encoded in the URL query parameter
      // The path parameter value is URL-encoded, but the query string structure is not double-encoded
      expect(urls[0]).toContain('path=%2Fpath%2Fto%2Ftest%20with%20spaces.png')
      expect(urls[1]).toContain('%E7%89%B9%E6%AE%8A%E5%AD%97%E7%AC%A6')
    })
  })

  describe('hasScreenshot', () => {
    test('returns true when screenshotPaths array has items', () => {
      const task = {
        meta: {
          screenshotPaths: ['/path/to/test.png'],
        },
      } as RunnerTask

      expect(hasScreenshot(task)).toBe(true)
    })

    test('returns true when failScreenshotPath exists', () => {
      const task = {
        meta: {
          failScreenshotPath: '/path/to/failure.png',
        },
      } as RunnerTask

      expect(hasScreenshot(task)).toBe(true)
    })

    test('returns false when no screenshots exist', () => {
      const task = {
        meta: {},
      } as RunnerTask

      expect(hasScreenshot(task)).toBe(false)
    })

    test('returns false when screenshotPaths is empty array', () => {
      const task = {
        meta: {
          screenshotPaths: [],
        },
      } as unknown as RunnerTask

      expect(hasScreenshot(task)).toBe(false)
    })
  })
})
