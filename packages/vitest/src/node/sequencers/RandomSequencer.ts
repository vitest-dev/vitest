import type { TestSpecification } from '../spec'
import { shuffle } from '@vitest/utils'
import { BaseSequencer } from './BaseSequencer'

export class RandomSequencer extends BaseSequencer {
  public async sort(files: TestSpecification[]) {
    const { sequence } = this.ctx.config

    return shuffle(files, sequence.seed)
  }
}
