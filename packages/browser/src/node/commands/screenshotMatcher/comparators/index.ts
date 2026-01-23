import type { BrowserCommandContext } from 'vitest/node'
import type { ScreenshotComparatorRegistry } from '../../../../../context'
import type { Comparator } from '../types'
import { blazediffCore } from './blazediff-core'

const comparators: {
  [ComparatorName in keyof ScreenshotComparatorRegistry]: Comparator<
    ScreenshotComparatorRegistry[ComparatorName]
  >
} = {
  '@blazediff/core': blazediffCore,
  'pixelmatch': blazediffCore,
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
