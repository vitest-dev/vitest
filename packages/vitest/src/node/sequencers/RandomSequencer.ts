import type { TestSpecification } from '../test-specification'
import { shuffle } from '@vitest/utils/helpers'
import { BaseSequencer } from './BaseSequencer'

export class RandomSequencer extends BaseSequencer {
  public async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    const { sequence } = this.ctx.config

    const sorted = [...files].sort((a, b) =>
      compare(a.project.name, b.project.name)
      || compare(a.moduleId, b.moduleId)
      || compare(a.pool, b.pool),
    )
    return shuffle(sorted, sequence.seed)
  }
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
