import { shuffle } from '@vitest/utils'
import { BaseSequencer } from './BaseSequencer'

export class RandomSequencer extends BaseSequencer {
  public async sort(files: string[]) {
    const { sequence } = this.ctx.config

    return shuffle(files, sequence.seed)
  }
}
