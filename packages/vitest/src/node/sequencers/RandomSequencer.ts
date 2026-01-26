import type { TestSpecification } from '../test-specification'
import { shuffle } from '@vitest/utils/helpers'
import { BaseSequencer } from './BaseSequencer'

export class RandomSequencer extends BaseSequencer {
  public async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    const { sequence } = this.ctx.config

    return shuffle(files, sequence.seed)
  }
}
