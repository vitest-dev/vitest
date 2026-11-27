import type { RandomSource } from '@vitest/utils/random-source'
import type { TaskResultRepeats } from '../runtime/runner/types'
import { createRandomSource, deriveSeed } from '@vitest/utils/random-source'
import { getRepeatRun } from './tasks'

export const DEFAULT_SHRINK_TIME = 10_000

// a longer tape fills the terminal
export const MAX_SHOWN_TAPE_LENGTH = 200

// a longer example in `Keep`, or longer values in `Values`, fill the terminal
export const MAX_KEEP_LINES = 30

// messages show only the start of a long tape
export function shortenTape(text: string): string {
  return text.length > MAX_SHOWN_TAPE_LENGTH
    ? `${text.slice(0, MAX_SHOWN_TAPE_LENGTH)}… (${text.length} characters)`
    : text
}

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

// The kept seeds run after the examples, and the next repeat uses the base seed, unless the kept
// seeds already have it. An example has no seed.
export function getRepeatSeed(
  repeats: Pick<TaskResultRepeats, 'base' | 'examples' | 'seeds'>,
  index: number,
): string | undefined {
  const { repeat } = getRepeatRun(repeats, index)
  if (repeat === undefined) {
    return undefined
  }
  const { base, seeds } = repeats
  if (repeat < seeds.length) {
    return seeds[repeat]
  }
  const generated = repeat - seeds.length + (seeds.includes(base) ? 1 : 0)
  return generated === 0 ? base : deriveSeed(['random', base, String(generated)])
}
