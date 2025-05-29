import type { ComparatorRegistry } from '../../../../../context'
import type { Comparator } from '../types'
import pm from 'pixelmatch'

export const pixelmatch: Comparator<ComparatorRegistry['pixelmatch']> = (
  reference,
  actual,
  { createDiff, ...options },
) => {
  const diffBuffer = createDiff
    ? new Uint8Array(reference.data.length)
    : undefined

  const result = pm(
    reference.data,
    actual.data,
    diffBuffer,
    reference.metadata.width,
    reference.metadata.height,
    options,
  )

  return {
    pass: result < 1,
    diff: diffBuffer ?? null,
  }
}
