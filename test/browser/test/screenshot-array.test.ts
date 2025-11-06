import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'

describe('screenshot array storage', () => {
  test('screenshotPaths array is cleared on retry', { retry: 1 }, async ({ task }) => {
    // This test verifies that the screenshotPaths array is cleared before each
    // retry attempt to prevent memory leaks in long test runs with retries

    // Use Vitest's built-in retryCount property to track attempts
    const retryCount = task.result?.retryCount || 0

    if (retryCount === 0) {
      // First attempt: verify array starts empty
      expect(task.meta.screenshotPaths).toBeUndefined()

      // Take a screenshot
      const screenshot = await page.screenshot()
      expect(screenshot).toBeTruthy()
      expect(task.meta.screenshotPaths!.length).toBe(1)

      // Force retry by throwing error
      throw new Error('Intentional error to trigger retry')
    }
    else {
      // Second attempt: THIS is where we verify the array was cleared
      // The onBeforeTryTask hook should have cleared the array
      const initialLength = task.meta.screenshotPaths?.length || 0
      expect(initialLength).toBe(0) // Array should be cleared!

      // Take a new screenshot in the retry
      const screenshot = await page.screenshot()
      expect(screenshot).toBeTruthy()

      // Should only have 1 screenshot from THIS attempt, not 2 total
      expect(task.meta.screenshotPaths!.length).toBe(1)
    }
  })

  test('manual screenshots should appear in screenshotPaths array', async ({ task }) => {
    // Verify array starts fresh
    const initialLength = task.meta.screenshotPaths?.length || 0

    // Take multiple manual screenshots
    const screenshot1 = await page.screenshot()
    const screenshot2 = await page.screenshot()

    // Verify screenshots were taken and are different
    expect(screenshot1).toBeTruthy()
    expect(screenshot2).toBeTruthy()
    expect(screenshot1).not.toBe(screenshot2)

    // Verify they're stored in the array
    expect(task.meta.screenshotPaths).toBeDefined()
    expect(Array.isArray(task.meta.screenshotPaths)).toBe(true)
    expect(task.meta.screenshotPaths!.length).toBe(initialLength + 2)
    expect(task.meta.screenshotPaths).toContain(screenshot1)
    expect(task.meta.screenshotPaths).toContain(screenshot2)
  })

  test('deduplication removes duplicate screenshot paths', async ({ task }) => {
    // Take a screenshot
    const screenshot = await page.screenshot()
    expect(screenshot).toBeTruthy()

    // Manually add the same screenshot path again to simulate a duplicate
    // (This can happen when both screenshotFailures and screenshotTestEnd are enabled)
    task.meta.screenshotPaths!.push(screenshot as string)

    // Now the array should have duplicates
    expect(task.meta.screenshotPaths!.length).toBe(2)
    expect(task.meta.screenshotPaths![0]).toBe(task.meta.screenshotPaths![1])

    // Use Set to deduplicate (same logic as UI layer)
    const uniquePaths = [...new Set(task.meta.screenshotPaths)]

    // After deduplication, should only have 1 unique path
    expect(uniquePaths.length).toBe(1)
    expect(uniquePaths[0]).toBe(screenshot)
  })

  test('multiple manual screenshots maintain correct order', async ({ task }) => {
    // Take 3 screenshots in sequence
    const screenshot1 = await page.screenshot()
    const screenshot2 = await page.screenshot()
    const screenshot3 = await page.screenshot()

    // Verify all are different
    expect(screenshot1).not.toBe(screenshot2)
    expect(screenshot2).not.toBe(screenshot3)
    expect(screenshot1).not.toBe(screenshot3)

    // Verify they're in the array in order
    expect(task.meta.screenshotPaths!.length).toBe(3)
    expect(task.meta.screenshotPaths![0]).toBe(screenshot1)
    expect(task.meta.screenshotPaths![1]).toBe(screenshot2)
    expect(task.meta.screenshotPaths![2]).toBe(screenshot3)
  })

  test('screenshotPaths array is initialized when taking first screenshot', async ({ task }) => {
    // Before taking any screenshot, array might not exist or be undefined
    // Take a screenshot
    await page.screenshot()

    // Now array should be initialized and have one entry
    expect(task.meta.screenshotPaths).toBeDefined()
    expect(Array.isArray(task.meta.screenshotPaths)).toBe(true)
    expect(task.meta.screenshotPaths!.length).toBeGreaterThan(0)
  })
})
