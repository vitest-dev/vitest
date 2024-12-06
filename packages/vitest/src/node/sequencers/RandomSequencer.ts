import type { WorkspaceSpec } from '../pool'
import { shuffle } from '@vitest/utils'
import { BaseSequencer } from './BaseSequencer'

export class RandomSequencer extends BaseSequencer {
  public async sort(files: WorkspaceSpec[]) {
    const { sequence } = this.ctx.config

    return shuffle(files, sequence.seed)
  }
}
