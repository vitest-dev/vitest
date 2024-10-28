import { GlobalSetupContext } from 'vitest/node';

const calls: string[] = [];

(globalThis as any).__CALLS = calls

export default ({ onWatcherRerun }: GlobalSetupContext) => {
  calls.push('start')
  onWatcherRerun(() => {
    calls.push('rerun')
  })
  return () => {
    calls.push('end')
  }
}
