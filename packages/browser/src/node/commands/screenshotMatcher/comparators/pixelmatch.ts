import type { Comparators } from '../../../../../screenshot'
import pm from 'pixelmatch'

export const pixelmatch: Comparators['pixelmatch']['instance'] = (
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
    pass: result > 0,
    diff: diffBuffer ?? null,
  }
}
