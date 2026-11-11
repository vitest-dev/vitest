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

// the seeds in `include` run first, and the next repeat uses the base seed,
// unless `include` already has it
export function getRepeatSeed(
  { base, include }: Pick<TaskResultRepeats, 'base' | 'include'>,
  index: number,
): string {
  if (index < include.length) {
    return include[index]
  }
  const generated = index - include.length + (include.includes(base) ? 1 : 0)
  return generated === 0 ? base : deriveSeed(['random', base, String(generated)])
}
