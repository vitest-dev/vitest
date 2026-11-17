import type { TestSpecification } from '../test-specification'
import { shuffle } from '@vitest/utils/helpers'
import { BaseSequencer } from './BaseSequencer'

export class RandomSequencer extends BaseSequencer {
  public async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    const { sequence } = this.ctx.config

    // the glob order can change between runs, so only the seed may decide the order
    const sorted = [...files].sort(compareSpecifications)
    return shuffle(sorted, sequence.seed)
  }
}

function compareSpecifications(a: TestSpecification, b: TestSpecification): number {
  return (
    compareStrings(a.project.name, b.project.name) ||
    compareStrings(a.moduleId, b.moduleId) ||
    compareStrings(a.pool, b.pool)
  )
}

// `localeCompare` depends on the locale of the machine, which makes `--seed` unreproducible
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
