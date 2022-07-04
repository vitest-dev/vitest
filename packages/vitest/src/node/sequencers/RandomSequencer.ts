import { randomize } from '../../utils'
import { BaseSequencer } from './BaseSequencer'

export class RandomSequencer extends BaseSequencer {
  public async sort(files: string[]) {
    const { sequence } = this.ctx.config

    const seed = sequence?.seed ?? Date.now()

    return randomize(files, seed)
  }
}
