import type { Comparator, Comparators } from '../../../../../screenshot'
import { pixelmatch } from './pixelmatch'

function guard<C extends Comparator<any>>(comparator: C): C {
  return ((reference, actual, options) => {
    if (reference.metadata.height !== actual.metadata.height || reference.metadata.width !== actual.metadata.width) {
      return {
        pass: false,
        diff: null,
      }
    }

    return comparator(reference, actual, options)
  }) as C
}

const comparators = new Map(Object.entries({
  pixelmatch,
} satisfies {
  [k in keyof Comparators]: Comparators[k]['instance']
}))

export function getComparator<Comparator extends keyof Comparators>(
  comparator: Comparator,
): Comparators[Comparator]['instance'] {
  if (comparators.has(comparator)) {
    return guard(comparators.get(comparator)!)
  }

  throw new Error(`Unrecognized comparator ${comparator}`)
}
