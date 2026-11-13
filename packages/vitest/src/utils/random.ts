import type { RandomSource } from '@vitest/utils/random-source'
import { createRandomSource, deriveSeed } from '@vitest/utils/random-source'

export function createLabelRandom(
  seed: string,
  projectName: string,
  labels: readonly string[],
): RandomSource {
  for (const label of labels) {
    if (typeof label !== 'string') {
      throw new TypeError(`createRandom() expects string labels, received ${typeof label}.`)
    }
  }
  return createRandomSource(deriveSeed(['label', seed, projectName, ...labels]))
}
