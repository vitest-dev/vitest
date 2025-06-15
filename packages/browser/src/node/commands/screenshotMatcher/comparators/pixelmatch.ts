import type { ScreenshotComparatorRegistry } from '../../../../../context'
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
} satisfies ScreenshotComparatorRegistry['pixelmatch']

export const pixelmatch: Comparator<ScreenshotComparatorRegistry['pixelmatch']> = (
  reference,
  actual,
  { createDiff, ...options },
) => {
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

  const optionsWithDefaults = { ...defaultOptions, ...options }
  const diffBuffer = createDiff
    ? new Uint8Array(reference.data.length)
    : undefined

  const mismatchedPixels = pm(
    reference.data,
    actual.data,
    diffBuffer,
    reference.metadata.width,
    reference.metadata.height,
    optionsWithDefaults,
  )

  const imageArea = reference.metadata.width * reference.metadata.height

  let allowedMismatchedPixels = Math.min(
    optionsWithDefaults.allowedMismatchedPixels ?? Number.POSITIVE_INFINITY,
    (optionsWithDefaults.allowedMismatchedPixelRatio
      ?? Number.POSITIVE_INFINITY)
    * imageArea,
  )

  if (allowedMismatchedPixels === Number.POSITIVE_INFINITY) {
    allowedMismatchedPixels = 0
  }

  const pass = mismatchedPixels <= allowedMismatchedPixels

  return {
    pass,
    diff: diffBuffer ?? null,
    message: pass
      ? null
      : `${mismatchedPixels} pixels (ratio ${(
        // as we compare using `<=`, use `Math.ceil` to ensure the reported ratio
        // doesn't appear equal to the allowed limit when it's a bit over
        Math.ceil((mismatchedPixels / imageArea) * 100) / 100
      ).toFixed(2)}) differ.`,
  }
}
