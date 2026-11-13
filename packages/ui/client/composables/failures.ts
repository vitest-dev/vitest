import type { RunnerTestCase } from 'vitest'
import type { TestFailureReport } from '../../../vitest/src/types/general'
import { shallowReactive } from 'vue'
import { client } from './client'

const reports = shallowReactive(new Map<string, { result: object; report: TestFailureReport }>())
const requested = new WeakSet<object>()

// the errors of a finished test in the groups of the terminal, with their seeds
export function getFailureReport(test: RunnerTestCase): TestFailureReport | undefined {
  const result = test.result
  if (
    !result ||
    result.state === 'run' ||
    result.state === 'queued' ||
    !result.attempts?.some((attempt) => attempt.state === 'fail')
  ) {
    return undefined
  }
  if (!requested.has(result)) {
    requested.add(result)
    client.rpc.getFailureReports([test.id]).then((received) => {
      const report = received[test.id]
      if (report) {
        reports.set(test.id, { result, report })
      }
    })
  }
  const entry = reports.get(test.id)
  return entry?.result === result ? entry.report : undefined
}
