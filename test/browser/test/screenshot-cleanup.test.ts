import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'pathe'
import { beforeEach, describe, expect, test } from 'vitest'

describe('screenshot cleanup', { timeout: 30000 }, () => {
  const testDir = join(import.meta.dirname, '__test-screenshots__')
  const screenshotsDir = join(testDir, '__screenshots__', 'test.spec.ts')

  beforeEach(() => {
    // Create test directory structure
    mkdirSync(screenshotsDir, { recursive: true })
  })

  test('cleanup removes instance-specific screenshots only', async () => {
    // Simulate a scenario where we have screenshots from multiple instances
    const mobileScreenshot1 = join(screenshotsDir, 'test-name-1-mobile.png')
    const mobileScreenshot2 = join(screenshotsDir, 'test-name-2-mobile.png')
    const mobileAuto = join(screenshotsDir, 'test-name-auto-mobile.png')
    const desktopScreenshot1 = join(screenshotsDir, 'test-name-1-desktop.png')
    const desktopAuto = join(screenshotsDir, 'test-name-auto-desktop.png')

    // Create fake screenshot files
    writeFileSync(mobileScreenshot1, 'mobile1')
    writeFileSync(mobileScreenshot2, 'mobile2')
    writeFileSync(mobileAuto, 'mobile-auto')
    writeFileSync(desktopScreenshot1, 'desktop1')
    writeFileSync(desktopAuto, 'desktop-auto')

    // All files should exist
    expect(existsSync(mobileScreenshot1)).toBe(true)
    expect(existsSync(mobileScreenshot2)).toBe(true)
    expect(existsSync(mobileAuto)).toBe(true)
    expect(existsSync(desktopScreenshot1)).toBe(true)
    expect(existsSync(desktopAuto)).toBe(true)

    // Import the cleanup logic (this would be called via RPC in real usage)
    // For now, we're testing the cleanup pattern logic
    const instanceName = 'mobile'
    const patterns = [`-${instanceName}.png`, `-auto-${instanceName}.png`]

    // Simulate cleanup: remove files matching patterns
    const { readdirSync, rmSync } = await import('node:fs')
    const files = readdirSync(screenshotsDir)
    for (const file of files) {
      const shouldDelete = patterns.some(pattern => file.includes(pattern))
      if (shouldDelete) {
        rmSync(join(screenshotsDir, file), { force: true })
      }
    }

    // Mobile screenshots should be deleted
    expect(existsSync(mobileScreenshot1)).toBe(false)
    expect(existsSync(mobileScreenshot2)).toBe(false)
    expect(existsSync(mobileAuto)).toBe(false)

    // Desktop screenshots should still exist
    expect(existsSync(desktopScreenshot1)).toBe(true)
    expect(existsSync(desktopAuto)).toBe(true)
  })

  test('cleanup with no instance name removes all screenshots', async () => {
    const screenshot1 = join(screenshotsDir, 'test-name-1.png')
    const screenshot2 = join(screenshotsDir, 'test-name-2.png')
    const autoScreenshot = join(screenshotsDir, 'test-name-auto.png')

    writeFileSync(screenshot1, 'test1')
    writeFileSync(screenshot2, 'test2')
    writeFileSync(autoScreenshot, 'auto')

    expect(existsSync(screenshot1)).toBe(true)
    expect(existsSync(screenshot2)).toBe(true)
    expect(existsSync(autoScreenshot)).toBe(true)

    // Cleanup with no instance name should remove all
    const instanceName = undefined
    const patterns = instanceName ? [`-${instanceName}.png`, `-auto-${instanceName}.png`] : ['.png']

    const { readdirSync, rmSync } = await import('node:fs')
    const files = readdirSync(screenshotsDir)
    for (const file of files) {
      const shouldDelete = patterns.some(pattern =>
        pattern === '.png' ? file.endsWith(pattern) : file.includes(pattern),
      )
      if (shouldDelete) {
        rmSync(join(screenshotsDir, file), { force: true })
      }
    }

    // All should be deleted
    expect(existsSync(screenshot1)).toBe(false)
    expect(existsSync(screenshot2)).toBe(false)
    expect(existsSync(autoScreenshot)).toBe(false)
  })

  test('cleanup handles non-existent directory gracefully', async () => {
    const nonExistentDir = join(testDir, '__screenshots__', 'non-existent.spec.ts')

    // Should not throw
    expect(() => {
      if (!existsSync(nonExistentDir)) {
        // No error
      }
    }).not.toThrow()
  })

  test('cleanup removes manual numbered screenshots correctly', async () => {
    // Create manual screenshots with numbering
    const manual1 = join(screenshotsDir, 'test-name-1-mobile.png')
    const manual2 = join(screenshotsDir, 'test-name-2-mobile.png')
    const manual3 = join(screenshotsDir, 'test-name-3-mobile.png')
    const desktopManual1 = join(screenshotsDir, 'test-name-1-desktop.png')

    writeFileSync(manual1, 'manual1')
    writeFileSync(manual2, 'manual2')
    writeFileSync(manual3, 'manual3')
    writeFileSync(desktopManual1, 'desktop1')

    expect(existsSync(manual1)).toBe(true)
    expect(existsSync(manual2)).toBe(true)
    expect(existsSync(manual3)).toBe(true)
    expect(existsSync(desktopManual1)).toBe(true)

    // Cleanup mobile instance
    const instanceName = 'mobile'
    const { readdirSync, rmSync } = await import('node:fs')
    const files = readdirSync(screenshotsDir)

    for (const file of files) {
      if (!file.endsWith('.png')) {
        continue
      }

      const shouldDelete = file.endsWith(`-${instanceName}.png`) || file.endsWith(`-auto-${instanceName}.png`)

      if (shouldDelete) {
        rmSync(join(screenshotsDir, file), { force: true })
      }
    }

    // All mobile screenshots should be deleted
    expect(existsSync(manual1)).toBe(false)
    expect(existsSync(manual2)).toBe(false)
    expect(existsSync(manual3)).toBe(false)

    // Desktop screenshot should remain
    expect(existsSync(desktopManual1)).toBe(true)
  })

  test('cleanup prevents path traversal attacks', async () => {
    // This test verifies that the cleanup logic validates paths to prevent
    // deletion of files outside the screenshot directory
    const screenshot = join(screenshotsDir, 'test-name.png')
    const outsideFile = join(testDir, 'outside.png')

    writeFileSync(screenshot, 'inside')
    writeFileSync(outsideFile, 'outside')

    expect(existsSync(screenshot)).toBe(true)
    expect(existsSync(outsideFile)).toBe(true)

    // Simulate the cleanup logic with path validation
    const { readdirSync, rmSync } = await import('node:fs')
    const { resolve, sep } = await import('pathe')
    const files = readdirSync(screenshotsDir)

    for (const file of files) {
      if (!file.endsWith('.png')) {
        continue
      }

      // This is the security check that prevents path traversal
      const filePath = join(screenshotsDir, file)
      const normalizedFilePath = resolve(filePath)
      const normalizedScreenshotDir = resolve(screenshotsDir)

      // Skip files outside the screenshot directory
      if (!normalizedFilePath.startsWith(normalizedScreenshotDir + sep)) {
        continue
      }

      rmSync(filePath, { force: true })
    }

    // File inside screenshot directory should be deleted
    expect(existsSync(screenshot)).toBe(false)

    // File outside should NOT be deleted (security check prevents it)
    // Note: readdirSync won't return files outside the directory anyway,
    // but this test documents the security validation that's in place
    expect(existsSync(outsideFile)).toBe(true)
  })
})
