import type { BrowserCommandContext } from 'vitest/node'
import type { ScreenshotComparatorRegistry } from '../../../../../context'
import type { Comparator } from '../types'
import { pixelmatch } from './pixelmatch'

const comparators: {
  [ComparatorName in keyof ScreenshotComparatorRegistry]: Comparator<
    ScreenshotComparatorRegistry[ComparatorName]
  >
} = {
  pixelmatch,
}

export function getComparator<ComparatorName extends keyof ScreenshotComparatorRegistry>(
  comparator: ComparatorName,
  context: BrowserCommandContext,
): Comparator<ScreenshotComparatorRegistry[ComparatorName]> {
  if (comparator in comparators) {
    return comparators[comparator]
  }

  const customComparators = context
    .project
    .config
    .browser
    .expect
    ?.toMatchScreenshot
    ?.comparators

  if (customComparators && comparator in customComparators) {
    return customComparators[comparator]
  }

  throw new Error(`Unrecognized comparator ${comparator}`)
}

export type AnyComparator = Comparator<ScreenshotComparatorRegistry[keyof ScreenshotComparatorRegistry]>
