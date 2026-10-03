import { describe, expect, test } from 'vitest'
import { createScreenshotFileName } from '../../../packages/browser/src/client/tester/screenshotFileName'

describe('createScreenshotFileName', () => {
  test('keeps short names unchanged', () => {
    expect(createScreenshotFileName('screenshot-unstable', { sanitize: 'nonWord' })).toBe(
      'screenshot-unstable.png',
    )
    expect(
      createScreenshotFileName('my test', { sanitize: 'alphanumeric', repeatNumber: 2 }),
    ).toBe('my-test-2.png')
  })

  test('truncates long names and keeps them within the file name limit', () => {
    const longName = `Feature ${'step '.repeat(120)}`
    const fileName = createScreenshotFileName(longName, { sanitize: 'nonWord' })

    expect(fileName.endsWith('.png')).toBe(true)
    expect(fileName.length).toBeLessThanOrEqual(255)
    expect(fileName).toMatch(/-[a-z0-9]{1,8}\.png$/)
  })

  test('uses different hashes for different full names with the same prefix', () => {
    const prefix = 'Feature '.repeat(40)
    const first = createScreenshotFileName(`${prefix}one`, { sanitize: 'nonWord' })
    const second = createScreenshotFileName(`${prefix}two`, { sanitize: 'nonWord' })

    expect(first).not.toBe(second)
    expect(first.length).toBeLessThanOrEqual(255)
    expect(second.length).toBeLessThanOrEqual(255)
  })
})
