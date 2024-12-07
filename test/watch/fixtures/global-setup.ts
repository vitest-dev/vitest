import { TestProject } from 'vitest/node';

const calls: string[] = [];

(globalThis as any).__CALLS = calls

export default (project: TestProject) => {
  calls.push('start')
  project.onTestsRerun(() => {
    calls.push('rerun')
  })
  return () => {
    calls.push('end')
  }
}
