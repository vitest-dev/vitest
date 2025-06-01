import type { ComparatorRegistry } from '../../../../../context'
import type { Comparator } from '../types'
import { pixelmatch } from './pixelmatch'

function guard<C extends Comparator<any>>(comparator: C): C {
  return ((reference, actual, options) => {
    if (reference.metadata.height !== actual.metadata.height || reference.metadata.width !== actual.metadata.width) {
      return {
        pass: false,
        diff: null,
        message: `Expected image dimensions to be ${reference.metadata.width}×${
          reference.metadata.height
        }px, but received ${actual.metadata.width}×${
          actual.metadata.height
        }px.`,
      }
    }

    return comparator(reference, actual, options)
  }) satisfies Comparator<any> as C
}

const comparators = new Map(Object.entries({
  pixelmatch,
} satisfies {
  [ComparatorName in keyof ComparatorRegistry]: Comparator<
    ComparatorRegistry[ComparatorName]
  >
}))

export function getComparator<ComparatorName extends keyof ComparatorRegistry>(
  comparator: ComparatorName,
): Comparator<ComparatorRegistry[ComparatorName]> {
  if (comparators.has(comparator)) {
    return guard(comparators.get(comparator)!)
  }

  throw new Error(`Unrecognized comparator ${comparator}`)
}

export type AnyComparator = Comparator<ComparatorRegistry[keyof ComparatorRegistry]>
