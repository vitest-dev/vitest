import type { TestSpecification } from '../test-specification'
import { shuffle } from '@vitest/utils/helpers'
import { BaseSequencer } from './BaseSequencer'

export class RandomSequencer extends BaseSequencer {
  public async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    const { sequence } = this.ctx.config

    // Sort by moduleId before shuffling so the seed produces a consistent
    // order regardless of filesystem glob ordering, which varies between runs.
    const sorted = [...files].sort((a, b) =>
      a.moduleId.localeCompare(b.moduleId),
    )
    return shuffle(sorted, sequence.seed)
  }
}
