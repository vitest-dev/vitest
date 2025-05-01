import type { AsyncExpectationResult, MatcherState } from '@vitest/expect'
import type { Locator } from '../locators'
import { page } from '@vitest/browser/context'

import { equals, iterableEquality, subsetEquality } from '@vitest/expect'
import { SnapshotClient } from '@vitest/snapshot'
import { compareImages } from './utils'

export interface ScreenshotOptions {
  threshold?: number
  // other options that might be needed
}

let _client: SnapshotClient

export function getSnapshotClient(): SnapshotClient {
  if (!_client) {
    _client = new SnapshotClient({
      isEqual: (received, expected) => {
        return equals(received, expected, [iterableEquality, subsetEquality])
      },
    })
  }
  return _client
}

export default async function toMatchScreenshot(
  this: MatcherState,
  received: Element | Locator,
  options: ScreenshotOptions = {},
): AsyncExpectationResult {
  if (this.isNot) {
    throw new Error('toMatchScreenshot cannot be used with "not"')
  }

  // Create a unique name for the screenshot
  const { currentTestName, testPath } = this
  if (!currentTestName || !testPath) {
    throw new Error('Test name or path undefined')
  }

  // Take a screenshot
  const screenshotDir = '__screenshots__'
  const currentPath = `${screenshotDir}/current/${currentTestName}.png`
  await page.screenshot({
    element: received instanceof Element ? received : await received.element(),
    path: currentPath,
  })

  // Generate reference path
  const referencePath = `${screenshotDir}/reference/${currentTestName}.png`

  const client = getSnapshotClient()

  try {
    // First, try using rawSnapshot to handle file management and update mode
    await client.assertRaw({
      received: currentPath,
      filepath: testPath,
      name: currentTestName,
      rawSnapshot: {
        file: referencePath,
        isScreenshot: true, // Custom flag to identify screenshot snapshots
      },
    })

    // If we get here, the reference doesn't exist yet and we're in update mode
    // or the comparison succeeded
    return {
      pass: true,
      message: () => 'Screenshot matches reference',
    }
  }
  catch (error) {
    // If both files exist, do image comparison
    try {
      const result = await compareImages(currentPath, referencePath, {
        threshold: options.threshold || 0.1,
      })

      if (result.pass) {
        return {
          pass: true,
          message: () => `Screenshot matches the reference (${result.diffPercentage}% difference)`,
        }
      }

      // Create a diff image for reporting
      const diffPath = `${screenshotDir}/diff/${currentTestName}.png`
      await result.saveDiff(diffPath)

      return {
        pass: false,
        message: () => `Screenshot doesn't match reference (${result.diffPercentage}% difference)`,
      }
    }
    catch {
      // If comparison fails or files don't exist, rethrow the original error
      throw error
    }
  }
}
