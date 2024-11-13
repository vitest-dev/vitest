import { GlobalSetupContext } from 'vitest/node';

const calls: string[] = [];

(globalThis as any).__CALLS = calls

export default ({ onTestsRerun }: GlobalSetupContext) => {
  calls.push('start')
  onTestsRerun(() => {
    calls.push('rerun')
  })
  return () => {
    calls.push('end')
  }
}
