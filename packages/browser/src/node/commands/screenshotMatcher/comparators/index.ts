import type { ScreenshotComparatorRegistry } from '../../../../../context'
import type { Comparator } from '../types'
import { pixelmatch } from './pixelmatch'

const comparators = new Map(Object.entries({
  pixelmatch,
} satisfies {
  [ComparatorName in keyof ScreenshotComparatorRegistry]: Comparator<
    ScreenshotComparatorRegistry[ComparatorName]
  >
}))

export function getComparator<ComparatorName extends keyof ScreenshotComparatorRegistry>(
  comparator: ComparatorName,
): Comparator<ScreenshotComparatorRegistry[ComparatorName]> {
  if (comparators.has(comparator)) {
    return comparators.get(comparator)!
  }

  throw new Error(`Unrecognized comparator ${comparator}`)
}

export type AnyComparator = Comparator<ScreenshotComparatorRegistry[keyof ScreenshotComparatorRegistry]>
