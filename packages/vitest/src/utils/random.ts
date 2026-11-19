import type { RandomSource } from '@vitest/utils/random-source'
import type { TaskResultRepeats } from '../runtime/runner/types'
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

// the kept seeds run first, and the next repeat uses the base seed,
// unless the kept seeds already have it
export function getRepeatSeed(
  { base, seeds }: Pick<TaskResultRepeats, 'base' | 'seeds'>,
  index: number,
): string {
  if (index < seeds.length) {
    return seeds[index]
  }
  const generated = index - seeds.length + (seeds.includes(base) ? 1 : 0)
  return generated === 0 ? base : deriveSeed(['random', base, String(generated)])
}
