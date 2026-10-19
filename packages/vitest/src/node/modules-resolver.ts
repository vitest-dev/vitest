import type { Vitest } from './core'
import type { TestSpecification } from './test-specification'
import { AffectedModulesResolver } from './affected-modules'
import { RecordedModulesResolver } from './recorded-modules'

export function createModulesResolver(
  vitest: Vitest,
  specifications: ReadonlyArray<TestSpecification>,
): AffectedModulesResolver | RecordedModulesResolver {
  const specs = Array.from(specifications)
  return vitest.config.experimental.recordDependencies
    ? new RecordedModulesResolver(vitest, specs)
    : new AffectedModulesResolver(vitest, specs)
}
