import { existsSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'

describe('screenshot naming', () => {
  test('manual screenshots get sequential numbers', async () => {
    // Take multiple manual screenshots
    const screenshot1 = await page.screenshot()
    const screenshot2 = await page.screenshot()
    const screenshot3 = await page.screenshot()

    // All should be different paths
    expect(screenshot1).toBeTruthy()
    expect(screenshot2).toBeTruthy()
    expect(screenshot3).toBeTruthy()
    expect(screenshot1).not.toBe(screenshot2)
    expect(screenshot2).not.toBe(screenshot3)

    // Should contain sequential numbers
    expect(screenshot1).toContain('-1')
    expect(screenshot2).toContain('-2')
    expect(screenshot3).toContain('-3')

    // Verify files exist
    expect(existsSync(screenshot1!)).toBe(true)
    expect(existsSync(screenshot2!)).toBe(true)
    expect(existsSync(screenshot3!)).toBe(true)
  })

  test('auto-capture uses separate naming with -auto suffix', async () => {
    // This test will trigger auto-capture at the end when ui.screenshotsInReport is enabled
    // The auto-captured screenshot should have '-auto' in the name
    // Manual screenshots should not affect the auto-capture

    const screenshot1 = await page.screenshot()
    const screenshot2 = await page.screenshot()

    // Manual screenshots should be numbered sequentially
    expect(screenshot1).toContain('-1')
    expect(screenshot2).toContain('-2')

    // The auto-capture (triggered at end of test) should use '-auto' suffix
    // We can't directly verify this in the test itself, but the naming logic
    // ensures it won't clash with manual screenshots
  })
})
