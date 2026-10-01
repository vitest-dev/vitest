import { Suite } from "../../../../packages/vitest/src/runtime/runner"

export function getSuiteNames(suite?: Suite) {
  const names = []
  while (suite) {
    names.push(suite.name)
    suite = suite.suite
  }
  return names
}
