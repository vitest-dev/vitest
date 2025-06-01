import type { ComparatorRegistry } from '../../../../../context'
import type { Comparator } from '../types'
import pm from 'pixelmatch'

const defaultOptions = {
  allowedMismatchedPixelRatio: undefined,
  allowedMismatchedPixels: undefined,
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
  const optionsWithDefaults = { ...defaultOptions, ...options }
  const diffBuffer = createDiff
    ? new Uint8Array(reference.data.length)
    : undefined

  const result = pm(
    reference.data,
    actual.data,
    diffBuffer,
    reference.metadata.width,
    reference.metadata.height,
    optionsWithDefaults,
  )

  let allowedMismatchedPixels = Math.min(
    optionsWithDefaults.allowedMismatchedPixels ?? Number.POSITIVE_INFINITY,
    (optionsWithDefaults.allowedMismatchedPixelRatio
      ?? Number.POSITIVE_INFINITY)
    * reference.metadata.height
    * reference.metadata.width,
  )

  if (allowedMismatchedPixels === Number.POSITIVE_INFINITY) {
    allowedMismatchedPixels = 0
  }

  return {
    pass: result <= allowedMismatchedPixels,
    diff: diffBuffer ?? null,
  }
}
