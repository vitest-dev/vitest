import type { ComparatorRegistry } from '../../../../../context'
import type { Comparator } from '../types'
import pm from 'pixelmatch'

const defaultOptions = {
  threshold: 0.1,
  includeAA: false,
  alpha: 0.1,
  aaColor: [255, 255, 0],
  diffColor: [255, 0, 0],
  diffColorAlt: undefined,
  diffMask: false,
} satisfies ComparatorRegistry['pixelmatch']

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
    { ...defaultOptions, ...options },
  )

  return {
    pass: result < 1,
    diff: diffBuffer ?? null,
  }
}
